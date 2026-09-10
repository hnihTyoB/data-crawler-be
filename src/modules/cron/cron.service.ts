import fs from "fs";
import path from "path";
import { CronRepository, cronRepository } from "./cron.repository";
import { StorageFactory } from "../../common/storage/storage.factory";
import { IStorageService } from "../../common/storage/storage.interface";
import { MailService } from "../mail/mail.service";
import { cronQueue, CronQueueService } from "../../queues/cron.queue";
import {
  CRON_JOB_NAMES,
  CRON_JOB_STATUS,
  CronJobName,
  DEFAULT_AUDIT_LOG_RETENTION_DAYS,
  DEFAULT_EXPORT_RETENTION_DAYS,
  DEFAULT_CRON_SCHEDULES,
  DEFAULT_UNCONFIRMED_UPLOAD_MAX_AGE_HOURS,
} from "../../common/constants/cron.constant";
import { AUDIT_ACTIONS } from "../../common/constants/audit-action.constant";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import {
  AuditContext,
  CronJobExecutionResultDto,
  CronJobItemDto,
} from "./cron.dto";
import { DEFAULT_TIMEZONE } from "../../common/constants/timezone.constant";
import {
  getZonedDateParts,
  createUtcDateFromZonedParts,
} from "../../common/helpers/schedule-calculator.helper";
import {
  SystemConfigService,
  systemConfigService,
} from "../system-config/system-config.service";

export class CronService {
  constructor(
    private readonly repository: CronRepository = cronRepository,
    private readonly storageService: IStorageService = StorageFactory.getStorageService(),
    private readonly mailService: MailService = new MailService(),
    private readonly queueService: CronQueueService = cronQueue,
    private readonly configService: SystemConfigService = systemConfigService,
  ) {}

  /**
   * Danh sách toàn bộ các tác vụ định kỳ đã đăng ký trong hệ thống
   */
  async listJobs(search?: string): Promise<CronJobItemDto[]> {
    const jobNames = Object.keys(DEFAULT_CRON_SCHEDULES) as CronJobName[];
    const [latestRuns, statuses] = await Promise.all([
      this.repository.getLatestRunsForJobs(jobNames),
      this.repository.getJobStatuses(),
    ]);

    const jobs: CronJobItemDto[] = jobNames.map((name) => {
      const config = DEFAULT_CRON_SCHEDULES[name];
      const history = latestRuns.get(name);
      const isEnabled = statuses[name] ?? true;

      return {
        name,
        cron: config.cron,
        description: config.description,
        isEnabled,
        lastRun: history?.lastRun ? history.lastRun.toISOString() : undefined,
        lastStatus: history?.status || CRON_JOB_STATUS.READY,
        lastDurationMs: history?.durationMs,
      };
    });

    if (search && search.trim()) {
      const lower = search.trim().toLowerCase();
      return jobs.filter(
        (j) =>
          j.name.toLowerCase().includes(lower) ||
          j.description.toLowerCase().includes(lower),
      );
    }

    return jobs;
  }

  /**
   * Bật hoặc tắt kích hoạt tự động theo lịch của một Cron Job
   */
  async toggleJob(
    jobName: CronJobName,
    enabled: boolean,
    actorContext?: AuditContext,
  ): Promise<CronJobItemDto> {
    const config = DEFAULT_CRON_SCHEDULES[jobName];
    if (!config) {
      throw new AppError(
        `Tác vụ '${jobName}' không tồn tại trong hệ thống`,
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    // 1. Cập nhật trạng thái vào cơ sở dữ liệu (SystemConfig)
    await this.repository.setJobStatus(jobName, enabled);

    // 2. Đồng bộ lịch trình BullMQ Scheduler
    if (enabled) {
      await this.queueService.enableJobScheduler(jobName);
    } else {
      await this.queueService.disableJobScheduler(jobName);
    }

    // 3. Ghi vết Audit Log
    await this.repository.createAuditLog({
      actorId: actorContext?.actorId,
      action: AUDIT_ACTIONS.CRON_JOB_TOGGLED,
      details: {
        jobName,
        isEnabled: enabled,
      },
      ipAddress: actorContext?.ipAddress,
      userAgent: actorContext?.userAgent,
    });

    const latestRuns = await this.repository.getLatestRunsForJobs([jobName]);
    const history = latestRuns.get(jobName);

    return {
      name: jobName,
      cron: config.cron,
      description: config.description,
      isEnabled: enabled,
      lastRun: history?.lastRun ? history.lastRun.toISOString() : undefined,
      lastStatus: history?.status || CRON_JOB_STATUS.READY,
      lastDurationMs: history?.durationMs,
    };
  }

  /**
   * Kiểm tra một job có đang được kích hoạt hay không
   */
  async isJobEnabled(jobName: string): Promise<boolean> {
    const statuses = await this.repository.getJobStatuses();
    return statuses[jobName] ?? true;
  }

  /**
   * Kích hoạt chạy ngay một tác vụ thủ công từ REST API
   */
  async triggerJob(
    jobName: CronJobName,
    params?: Record<string, unknown>,
    actorContext?: AuditContext,
  ): Promise<CronJobExecutionResultDto> {
    const config = DEFAULT_CRON_SCHEDULES[jobName];
    if (!config) {
      throw new AppError(
        `Tác vụ '${jobName}' không tồn tại trong hệ thống`,
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    return this.executeJob(jobName, params, {
      ...actorContext,
      source: "MANUAL_TRIGGER",
    });
  }

  /**
   * Điều phối thực thi nghiệp vụ chi tiết theo tên tác vụ
   */
  async executeJob(
    jobName: CronJobName,
    params?: Record<string, unknown>,
    actorContext?: AuditContext,
  ): Promise<CronJobExecutionResultDto> {
    const startTime = Date.now();
    let executionData: Record<string, unknown> = {};
    let errorMsg: string | undefined;
    let isSuccess = true;

    try {
      switch (jobName) {
        case CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS: {
          executionData = await this.executeCleanupAuditLogs(
            params as { retentionDays?: number } | undefined,
          );
          break;
        }

        case CRON_JOB_NAMES.CLEANUP_EXPORTS: {
          executionData = await this.executeCleanupExports(
            params as { retentionDays?: number } | undefined,
          );
          break;
        }

        case CRON_JOB_NAMES.CLEANUP_UNCONFIRMED_UPLOADS: {
          executionData = await this.executeCleanupUnconfirmedUploads(
            params as { maxAgeHours?: number } | undefined,
          );
          break;
        }

        case CRON_JOB_NAMES.CLEANUP_EXPIRED_TOKENS: {
          executionData = await this.executeCleanupExpiredTokens();
          break;
        }

        case CRON_JOB_NAMES.DAILY_SUMMARY_DIGEST: {
          executionData = await this.executeDailySummaryDigest();
          break;
        }

        case CRON_JOB_NAMES.WEEKLY_SUMMARY_DIGEST: {
          executionData = await this.executeWeeklySummaryDigest();
          break;
        }

        default: {
          throw new AppError(
            `Tác vụ '${jobName}' chưa có trình xử lý thực thi`,
            400,
            ERROR_CODE.VALIDATION_ERROR,
          );
        }
      }
    } catch (err: unknown) {
      isSuccess = false;
      errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[CronService] Error executing job '${jobName}':`, err);
    }

    const durationMs = Date.now() - startTime;

    // Ghi nhận vết thực thi vào AuditLog
    try {
      await this.repository.createAuditLog({
        actorId: actorContext?.actorId,
        action:
          actorContext?.source === "MANUAL_TRIGGER"
            ? AUDIT_ACTIONS.CRON_JOB_TRIGGERED
            : AUDIT_ACTIONS.CRON_JOB_EXECUTED,
        details: {
          jobName,
          success: isSuccess,
          durationMs,
          params: params ?? null,
          data: executionData,
          error: errorMsg ?? null,
          source: actorContext?.source ?? "SCHEDULER",
        },
        ipAddress: actorContext?.ipAddress,
        userAgent: actorContext?.userAgent,
      });
    } catch (auditErr) {
      console.warn("[CronService] Failed to record execution audit log:", auditErr);
    }

    if (!isSuccess && !actorContext) {
      throw new Error(errorMsg);
    }

    return {
      jobName,
      success: isSuccess,
      durationMs,
      data: executionData,
      error: errorMsg,
    };
  }

  /**
   * Tác vụ: Xóa các bản ghi AuditLog cũ hơn số ngày quy định
   */
  async executeCleanupAuditLogs(params?: { retentionDays?: number }): Promise<{
    deletedCount: number;
    retentionDays: number;
    cutoffDate: string;
  }> {
    const isFeatureEnabled = await this.configService.get<boolean>(
      "feature.cron.cleanup_audit_logs.enabled",
      true,
    );
    if (!isFeatureEnabled && params?.retentionDays === undefined) {
      return {
        deletedCount: 0,
        retentionDays: 0,
        cutoffDate: new Date().toISOString(),
      };
    }

    const defaultRetention = await this.configService.get<number>(
      "retention.audit_logs_days",
      DEFAULT_AUDIT_LOG_RETENTION_DAYS,
    );
    const retentionDays = params?.retentionDays ?? defaultRetention;
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );

    const deletedCount = await this.repository.cleanupAuditLogs(cutoffDate);

    return {
      deletedCount,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
    };
  }

  /**
   * Tác vụ: Xóa các bản ghi CrawlExport và tệp tin xuất dữ liệu cũ hơn số ngày quy định
   */
  async executeCleanupExports(params?: { retentionDays?: number }): Promise<{
    cleanedExportsCount: number;
    retentionDays: number;
    cutoffDate: string;
  }> {
    const isFeatureEnabled = await this.configService.get<boolean>(
      "feature.cron.cleanup_exports.enabled",
      true,
    );
    if (!isFeatureEnabled && params?.retentionDays === undefined) {
      return {
        cleanedExportsCount: 0,
        retentionDays: 0,
        cutoffDate: new Date().toISOString(),
      };
    }

    const defaultRetention = await this.configService.get<number>(
      "retention.exports_days",
      DEFAULT_EXPORT_RETENTION_DAYS,
    );
    const retentionDays = params?.retentionDays ?? defaultRetention;
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );

    const { deletedCount, filePaths } =
      await this.repository.cleanupOldExports(cutoffDate, new Date());

    for (const filePath of filePaths) {
      try {
        await this.storageService.deleteFile(filePath);
      } catch (fileErr) {
        console.warn(
          `[Cron Cleanup] Could not delete export file ${filePath}:`,
          fileErr,
        );
      }
    }

    return {
      cleanedExportsCount: deletedCount,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
    };
  }

  /**
   * Tác vụ: Quét và dọn dẹp các tệp tin tải lên mồ côi và export đã hết hạn
   */
  async executeCleanupUnconfirmedUploads(params?: { maxAgeHours?: number }): Promise<{
    cleanedExportsCount: number;
    cleanedOrphanedAvatarsCount: number;
    maxAgeHours: number;
  }> {
    const maxAgeHours =
      params?.maxAgeHours ?? DEFAULT_UNCONFIRMED_UPLOAD_MAX_AGE_HOURS;
    const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    // 1. Dọn dẹp export file hết hạn
    const { deletedCount: cleanedExportsCount, filePaths } =
      await this.repository.cleanupExpiredExports(new Date());

    for (const filePath of filePaths) {
      try {
        await this.storageService.deleteFile(filePath);
      } catch (fileErr) {
        console.warn(`[Cron Cleanup] Could not delete export file ${filePath}:`, fileErr);
      }
    }

    // 2. Dọn dẹp avatar mồ côi trên đĩa cục bộ (nếu có)
    let cleanedOrphanedAvatarsCount = 0;
    try {
      const activeUrls = await this.repository.getActiveAvatarUrls();
      const activeBasenames = new Set(
        activeUrls.map((u) => path.basename(u)),
      );

      const avatarDir = path.resolve(process.cwd(), "storage/uploads/avatars");
      if (fs.existsSync(avatarDir)) {
        const files = fs.readdirSync(avatarDir);
        for (const file of files) {
          if (!activeBasenames.has(file)) {
            const fullPath = path.join(avatarDir, file);
            try {
              const stat = fs.statSync(fullPath);
              if (stat.mtime < cutoffDate) {
                fs.unlinkSync(fullPath);
                cleanedOrphanedAvatarsCount++;
              }
            } catch {}
          }
        }
      }
    } catch (avatarErr) {
      console.warn("[Cron Cleanup] Error scanning orphaned avatars:", avatarErr);
    }

    return {
      cleanedExportsCount,
      cleanedOrphanedAvatarsCount,
      maxAgeHours,
    };
  }

  /**
   * Tác vụ: Dọn dẹp các token hết hạn
   */
  async executeCleanupExpiredTokens(): Promise<{
    deletedRefreshTokens: number;
  }> {
    return this.repository.cleanupExpiredTokens(new Date());
  }

  /**
   * Tác vụ: Gửi email tổng hợp chỉ số ngày hôm trước
   */
  async executeDailySummaryDigest(): Promise<{
    recipientsCount: number;
    stats: Record<string, number>;
  }> {
    const now = new Date();
    const zonedParts = getZonedDateParts(now, DEFAULT_TIMEZONE);
    // Tính ngày hôm trước theo múi giờ UTC+7 (Asia/Ho_Chi_Minh)
    const prevDayLocal = new Date(
      Date.UTC(zonedParts.year, zonedParts.month, zonedParts.day - 1),
    );
    const pYear = prevDayLocal.getUTCFullYear();
    const pMonth = prevDayLocal.getUTCMonth();
    const pDay = prevDayLocal.getUTCDate();

    const startDate = createUtcDateFromZonedParts(
      pYear,
      pMonth,
      pDay,
      0,
      0,
      DEFAULT_TIMEZONE,
    );
    const endDate = new Date(
      createUtcDateFromZonedParts(
        pYear,
        pMonth,
        pDay,
        23,
        59,
        DEFAULT_TIMEZONE,
      ).getTime() + 59999,
    );

    const [stats, adminEmails] = await Promise.all([
      this.repository.getDigestStats(startDate, endDate),
      this.repository.getAdminEmails(),
    ]);

    if (adminEmails.length > 0) {
      await this.mailService.sendDigestEmail(
        adminEmails,
        `[Data Crawler] Báo Cáo Hoạt Động Hàng Ngày (${startDate.toLocaleDateString("vi-VN")})`,
        {
          period: "DAILY",
          startDate,
          endDate,
          stats,
        },
      );
    }

    return {
      recipientsCount: adminEmails.length,
      stats,
    };
  }

  /**
   * Tác vụ: Gửi email tổng hợp chỉ số tuần
   */
  async executeWeeklySummaryDigest(): Promise<{
    recipientsCount: number;
    stats: Record<string, number>;
  }> {
    const now = new Date();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = now;

    const [stats, adminEmails] = await Promise.all([
      this.repository.getDigestStats(startDate, endDate),
      this.repository.getAdminEmails(),
    ]);

    if (adminEmails.length > 0) {
      await this.mailService.sendDigestEmail(
        adminEmails,
        `[Data Crawler] Báo Cáo Hiệu Suất Hệ Thống Hàng Tuần (${startDate.toLocaleDateString("vi-VN")} - ${endDate.toLocaleDateString("vi-VN")})`,
        {
          period: "WEEKLY",
          startDate,
          endDate,
          stats,
        },
      );
    }

    return {
      recipientsCount: adminEmails.length,
      stats,
    };
  }
}

export const cronService = new CronService();
