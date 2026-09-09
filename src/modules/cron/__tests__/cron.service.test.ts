import { CronService } from "../cron.service";
import { CronRepository } from "../cron.repository";
import { IStorageService } from "../../../common/storage/storage.interface";
import { MailService } from "../../mail/mail.service";
import { CronQueueService } from "../../../queues/cron.queue";
import {
  CRON_JOB_NAMES,
  CRON_JOB_STATUS,
  DEFAULT_CRON_SCHEDULES,
} from "../../../common/constants/cron.constant";
import { AUDIT_ACTIONS } from "../../../common/constants/audit-action.constant";

describe("CronService", () => {
  let cronService: CronService;
  let mockRepository: jest.Mocked<CronRepository>;
  let mockStorageService: jest.Mocked<IStorageService>;
  let mockMailService: jest.Mocked<MailService>;
  let mockQueueService: jest.Mocked<CronQueueService>;

  beforeEach(() => {
    mockRepository = {
      getJobStatuses: jest.fn().mockResolvedValue({
        [CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS]: true,
        [CRON_JOB_NAMES.DAILY_SUMMARY_DIGEST]: false,
      }),
      setJobStatus: jest.fn().mockResolvedValue({}),
      getLatestRunsForJobs: jest.fn().mockResolvedValue(
        new Map([
          [
            CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS,
            {
              lastRun: new Date("2026-09-08T02:00:00.000Z"),
              status: CRON_JOB_STATUS.SUCCESS,
              durationMs: 120,
            },
          ],
        ]),
      ),
      createAuditLog: jest.fn().mockResolvedValue({} as any),
      cleanupAuditLogs: jest.fn().mockResolvedValue(45),
      cleanupExpiredTokens: jest.fn().mockResolvedValue({ deletedRefreshTokens: 12 }),
      cleanupExpiredExports: jest.fn().mockResolvedValue({
        deletedCount: 2,
        filePaths: ["exports/test1.zip", "exports/test2.zip"],
      }),
      getActiveAvatarUrls: jest.fn().mockResolvedValue([]),
      getDigestStats: jest.fn().mockResolvedValue({
        newUsers: 5,
        crawlJobsTotal: 10,
        crawlJobsCompleted: 8,
        crawlJobsFailed: 2,
        crawledPages: 150,
        exportsGenerated: 4,
        webhookDeliveries: 10,
        auditLogsRecorded: 80,
      }),
      getAdminEmails: jest.fn().mockResolvedValue(["admin@datacrawler.com"]),
    } as unknown as jest.Mocked<CronRepository>;

    mockStorageService = {
      uploadFile: jest.fn(),
      uploadStream: jest.fn(),
      downloadFile: jest.fn(),
      getReadStream: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true),
    };

    mockMailService = {
      sendDigestEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn(),
      sendVerificationEmail: jest.fn(),
      sendDeactivationEmail: jest.fn(),
    } as unknown as jest.Mocked<MailService>;

    mockQueueService = {
      getQueue: jest.fn(),
      registerDefaultSchedulers: jest.fn().mockResolvedValue(undefined),
      enableJobScheduler: jest.fn().mockResolvedValue(undefined),
      disableJobScheduler: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CronQueueService>;

    cronService = new CronService(
      mockRepository,
      mockStorageService,
      mockMailService,
      mockQueueService,
    );
  });

  describe("listJobs", () => {
    it("should return all configured jobs with correct status and history", async () => {
      const jobs = await cronService.listJobs();

      expect(jobs.length).toBe(Object.keys(DEFAULT_CRON_SCHEDULES).length);

      const auditLogJob = jobs.find(
        (j) => j.name === CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS,
      );
      expect(auditLogJob).toBeDefined();
      expect(auditLogJob?.isEnabled).toBe(true);
      expect(auditLogJob?.lastStatus).toBe(CRON_JOB_STATUS.SUCCESS);
      expect(auditLogJob?.lastDurationMs).toBe(120);

      const digestJob = jobs.find(
        (j) => j.name === CRON_JOB_NAMES.DAILY_SUMMARY_DIGEST,
      );
      expect(digestJob?.isEnabled).toBe(false);
    });

    it("should filter jobs when search parameter is provided", async () => {
      const jobs = await cronService.listJobs("audit");
      expect(jobs.length).toBe(1);
      expect(jobs[0].name).toBe(CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS);
    });
  });

  describe("toggleJob", () => {
    it("should update job status in DB, sync BullMQ, and record audit log", async () => {
      const result = await cronService.toggleJob(
        CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS,
        false,
        { actorId: "admin-1", ipAddress: "127.0.0.1", userAgent: "Jest" },
      );

      expect(mockRepository.setJobStatus).toHaveBeenCalledWith(
        CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS,
        false,
      );
      expect(mockQueueService.disableJobScheduler).toHaveBeenCalledWith(
        CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS,
      );
      expect(mockRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "admin-1",
          action: AUDIT_ACTIONS.CRON_JOB_TOGGLED,
          details: {
            jobName: CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS,
            isEnabled: false,
          },
        }),
      );
      expect(result.isEnabled).toBe(false);
    });

    it("should enable scheduler when enabled is true", async () => {
      await cronService.toggleJob(CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS, true);
      expect(mockQueueService.enableJobScheduler).toHaveBeenCalledWith(
        CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS,
      );
    });

    it("should throw 404 when job does not exist", async () => {
      await expect(
        cronService.toggleJob("non-existent-job" as any, true),
      ).rejects.toThrow();
    });
  });

  describe("triggerJob / executeJob", () => {
    it("should execute cleanup-audit-logs and record audit log", async () => {
      const result = await cronService.triggerJob(
        CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS,
        { retentionDays: 15 },
        { actorId: "admin-1" },
      );

      expect(result.success).toBe(true);
      expect(mockRepository.cleanupAuditLogs).toHaveBeenCalled();
      expect(result.data).toEqual(
        expect.objectContaining({
          deletedCount: 45,
          retentionDays: 15,
        }),
      );
      expect(mockRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUDIT_ACTIONS.CRON_JOB_TRIGGERED,
        }),
      );
    });

    it("should execute cleanup-unconfirmed-uploads and delete expired export files", async () => {
      const result = await cronService.triggerJob(
        CRON_JOB_NAMES.CLEANUP_UNCONFIRMED_UPLOADS,
      );

      expect(result.success).toBe(true);
      expect(mockRepository.cleanupExpiredExports).toHaveBeenCalled();
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith("exports/test1.zip");
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith("exports/test2.zip");
      expect(result.data).toEqual(
        expect.objectContaining({
          cleanedExportsCount: 2,
        }),
      );
    });

    it("should execute cleanup-expired-tokens", async () => {
      const result = await cronService.triggerJob(
        CRON_JOB_NAMES.CLEANUP_EXPIRED_TOKENS,
      );

      expect(result.success).toBe(true);
      expect(mockRepository.cleanupExpiredTokens).toHaveBeenCalled();
      expect(result.data).toEqual({ deletedRefreshTokens: 12 });
    });

    it("should execute daily-summary-digest and send email to admins", async () => {
      const result = await cronService.triggerJob(
        CRON_JOB_NAMES.DAILY_SUMMARY_DIGEST,
      );

      expect(result.success).toBe(true);
      expect(mockRepository.getDigestStats).toHaveBeenCalled();
      expect(mockRepository.getAdminEmails).toHaveBeenCalled();
      expect(mockMailService.sendDigestEmail).toHaveBeenCalledWith(
        ["admin@datacrawler.com"],
        expect.stringContaining("Báo Cáo Hoạt Động Hàng Ngày"),
        expect.objectContaining({ period: "DAILY" }),
      );
    });

    it("should execute weekly-summary-digest and send email to admins", async () => {
      const result = await cronService.triggerJob(
        CRON_JOB_NAMES.WEEKLY_SUMMARY_DIGEST,
      );

      expect(result.success).toBe(true);
      expect(mockRepository.getDigestStats).toHaveBeenCalled();
      expect(mockMailService.sendDigestEmail).toHaveBeenCalledWith(
        ["admin@datacrawler.com"],
        expect.stringContaining("Báo Cáo Hiệu Suất Hệ Thống Hàng Tuần"),
        expect.objectContaining({ period: "WEEKLY" }),
      );
    });
  });
});
