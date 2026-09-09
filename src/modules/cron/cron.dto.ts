import { CronJobName, CronJobStatus } from "../../common/constants/cron.constant";

export interface CronJobItemDto {
  name: CronJobName;
  cron: string;
  description: string;
  isEnabled: boolean;
  lastRun?: string;
  lastStatus?: CronJobStatus;
  lastDurationMs?: number;
}

export interface CronJobExecutionResultDto {
  jobName: CronJobName;
  success: boolean;
  durationMs: number;
  data?: Record<string, unknown>;
  error?: string;
}

export interface TriggerJobBodyDto {
  params?: Record<string, unknown>;
}

export interface ToggleJobBodyDto {
  enabled: boolean;
}

export interface ListJobsQueryDto {
  search?: string;
}

export interface AuditContext {
  actorId?: string;
  ipAddress?: string;
  userAgent?: string;
  source?: "MANUAL_TRIGGER" | "SCHEDULER";
}
