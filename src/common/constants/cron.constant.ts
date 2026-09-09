export const CRON_JOB_NAMES = {
  CLEANUP_AUDIT_LOGS: "cleanup-audit-logs",
  CLEANUP_UNCONFIRMED_UPLOADS: "cleanup-unconfirmed-uploads",
  CLEANUP_EXPIRED_TOKENS: "cleanup-expired-tokens",
  DAILY_SUMMARY_DIGEST: "daily-summary-digest",
  WEEKLY_SUMMARY_DIGEST: "weekly-summary-digest",
} as const;

export type CronJobName = (typeof CRON_JOB_NAMES)[keyof typeof CRON_JOB_NAMES];

export const CRON_JOB_STATUS = {
  READY: "READY",
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
} as const;

export type CronJobStatus =
  (typeof CRON_JOB_STATUS)[keyof typeof CRON_JOB_STATUS];

export const DEFAULT_CRON_TIMEZONE = "Asia/Ho_Chi_Minh" as const;

export const CRON_QUEUE_NAME = "cron-scheduler-queue" as const;

export const CRON_SYSTEM_CONFIG_KEY = "CRON_JOB_STATUSES" as const;

export const DEFAULT_AUDIT_LOG_RETENTION_DAYS = 30;

export const DEFAULT_UNCONFIRMED_UPLOAD_MAX_AGE_HOURS = 24;

export interface CronScheduleConfig {
  cron: string;
  description: string;
  defaultParams?: Record<string, unknown>;
}

export const DEFAULT_CRON_SCHEDULES: Record<CronJobName, CronScheduleConfig> = {
  [CRON_JOB_NAMES.CLEANUP_AUDIT_LOGS]: {
    cron: "0 2 * * *",
    description: "Dọn dẹp các bản ghi nhật ký kiểm toán cũ hơn số ngày quy định",
    defaultParams: {
      retentionDays: DEFAULT_AUDIT_LOG_RETENTION_DAYS,
    },
  },
  [CRON_JOB_NAMES.CLEANUP_UNCONFIRMED_UPLOADS]: {
    cron: "0 3 * * *",
    description: "Quét và dọn dẹp các tệp tin tải lên mồ côi hoặc xuất file tạm quá hạn",
    defaultParams: {
      maxAgeHours: DEFAULT_UNCONFIRMED_UPLOAD_MAX_AGE_HOURS,
    },
  },
  [CRON_JOB_NAMES.CLEANUP_EXPIRED_TOKENS]: {
    cron: "0 4 * * *",
    description: "Dọn dẹp các mã phiên xác thực và token đăng nhập đã hết hạn",
  },
  [CRON_JOB_NAMES.DAILY_SUMMARY_DIGEST]: {
    cron: "0 8 * * *",
    description: "Tổng hợp chỉ số hoạt động ngày hôm trước và gửi email báo cáo cho quản trị viên",
  },
  [CRON_JOB_NAMES.WEEKLY_SUMMARY_DIGEST]: {
    cron: "0 8 * * 1",
    description: "Tổng hợp chỉ số hiệu suất hệ thống 7 ngày gần nhất và gửi email báo cáo tuần",
  },
};
