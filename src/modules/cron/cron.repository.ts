import { prisma } from "../../database/prisma.client";
import { Prisma } from "@prisma/client";
import {
  CRON_JOB_STATUS,
  CRON_SYSTEM_CONFIG_KEY,
  CronJobStatus,
} from "../../common/constants/cron.constant";
import { AUDIT_ACTIONS } from "../../common/constants/audit-action.constant";

export interface CreateCronAuditLogInput {
  actorId?: string;
  action: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface JobRunHistoryItem {
  lastRun: Date;
  status: CronJobStatus;
  durationMs?: number;
}

export class CronRepository {
  /**
   * Lấy cấu hình cờ trạng thái bật/tắt của toàn bộ các Cron Jobs từ SystemConfig
   */
  async getJobStatuses(): Promise<Record<string, boolean>> {
    const config = await prisma.systemConfig.findUnique({
      where: { key: CRON_SYSTEM_CONFIG_KEY },
    });

    if (!config || typeof config.value !== "object" || config.value === null) {
      return {};
    }

    return config.value as Record<string, boolean>;
  }

  /**
   * Cập nhật trạng thái bật/tắt của một Cron Job cụ thể trong SystemConfig
   */
  async setJobStatus(
    jobName: string,
    enabled: boolean,
  ): Promise<Record<string, boolean>> {
    const currentStatuses = await this.getJobStatuses();
    const updatedStatuses = {
      ...currentStatuses,
      [jobName]: enabled,
    };

    await prisma.systemConfig.upsert({
      where: { key: CRON_SYSTEM_CONFIG_KEY },
      update: {
        value: updatedStatuses as unknown as Prisma.InputJsonValue,
      },
      create: {
        key: CRON_SYSTEM_CONFIG_KEY,
        value: updatedStatuses as unknown as Prisma.InputJsonValue,
        description: "Bảng trạng thái kích hoạt tự động của các tác vụ nền định kỳ (Cron Jobs)",
        category: "FEATURE_FLAG",
        isPublic: false,
      },
    });

    return updatedStatuses;
  }

  /**
   * Lấy lịch sử thực thi gần nhất của danh sách các tác vụ từ AuditLog
   */
  async getLatestRunsForJobs(
    jobNames: string[],
  ): Promise<Map<string, JobRunHistoryItem>> {
    const result = new Map<string, JobRunHistoryItem>();
    if (jobNames.length === 0) return result;

    const recentLogs = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            AUDIT_ACTIONS.CRON_JOB_EXECUTED,
            AUDIT_ACTIONS.CRON_JOB_TRIGGERED,
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    for (const log of recentLogs) {
      const details = log.details as Record<string, unknown> | null;
      const jobName = details?.jobName as string | undefined;

      if (jobName && jobNames.includes(jobName) && !result.has(jobName)) {
        const isSuccess = details?.success !== false;
        result.set(jobName, {
          lastRun: log.createdAt,
          status: isSuccess ? CRON_JOB_STATUS.SUCCESS : CRON_JOB_STATUS.FAILED,
          durationMs: typeof details?.durationMs === "number" ? details.durationMs : undefined,
        });
      }
    }

    return result;
  }

  /**
   * Ghi vết kiểm toán cho tác vụ định kỳ
   */
  async createAuditLog(data: CreateCronAuditLogInput) {
    return prisma.auditLog.create({
      data: {
        userId: data.actorId || null,
        action: data.action,
        details: (data.details ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });
  }

  /**
   * Xóa vĩnh viễn các bản ghi AuditLog cũ hơn thời điểm chỉ định
   */
  async cleanupAuditLogs(cutoffDate: Date): Promise<number> {
    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });
    return result.count;
  }

  /**
   * Dọn dẹp RefreshToken đã hết hạn trong 1 database transaction
   */
  async cleanupExpiredTokens(now: Date): Promise<{ deletedRefreshTokens: number }> {
    const [refreshTokensResult] = await prisma.$transaction([
      prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      }),
    ]);

    return {
      deletedRefreshTokens: refreshTokensResult.count,
    };
  }

  /**
   * Dọn dẹp các tệp xuất dữ liệu CrawlExport đã hết hạn (expiredAt < now)
   */
  async cleanupExpiredExports(
    now: Date,
  ): Promise<{ deletedCount: number; filePaths: string[] }> {
    const expiredExports = await prisma.crawlExport.findMany({
      where: {
        expiredAt: {
          not: null,
          lt: now,
        },
      },
      select: {
        id: true,
        filePath: true,
      },
    });

    if (expiredExports.length === 0) {
      return { deletedCount: 0, filePaths: [] };
    }

    const ids = expiredExports.map((e) => e.id);
    const filePaths = expiredExports.map((e) => e.filePath).filter(Boolean);

    await prisma.crawlExport.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return {
      deletedCount: ids.length,
      filePaths,
    };
  }

  /**
   * Lấy danh sách đường dẫn avatar đang được người dùng sử dụng
   */
  async getActiveAvatarUrls(): Promise<string[]> {
    const users = await prisma.user.findMany({
      where: {
        avatarUrl: {
          not: null,
        },
      },
      select: {
        avatarUrl: true,
      },
    });

    return users
      .map((u) => u.avatarUrl)
      .filter((url): url is string => Boolean(url));
  }

  /**
   * Tổng hợp các chỉ số hoạt động trong một khoảng thời gian
   */
  async getDigestStats(startDate: Date, endDate: Date) {
    const [
      newUsers,
      crawlJobsTotal,
      crawlJobsCompleted,
      crawlJobsFailed,
      crawledPages,
      exportsGenerated,
      webhookDeliveries,
      auditLogsRecorded,
    ] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.crawlJob.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.crawlJob.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: "COMPLETED",
        },
      }),
      prisma.crawlJob.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: "FAILED",
        },
      }),
      prisma.crawlPage.count({
        where: {
          crawledAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.crawlExport.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.webhookDelivery.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.auditLog.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
    ]);

    return {
      newUsers,
      crawlJobsTotal,
      crawlJobsCompleted,
      crawlJobsFailed,
      crawledPages,
      exportsGenerated,
      webhookDeliveries,
      auditLogsRecorded,
    };
  }

  /**
   * Lấy danh sách email quản trị viên hệ thống để gửi báo cáo
   */
  async getAdminEmails(): Promise<string[]> {
    const admins = await prisma.user.findMany({
      where: {
        role: "ADMIN",
        isActive: true,
      },
      select: {
        email: true,
      },
    });

    return admins.map((a) => a.email);
  }
}

export const cronRepository = new CronRepository();
