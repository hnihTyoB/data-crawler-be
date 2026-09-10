import { Queue } from "bullmq";
import { envConfig } from "../config/env.config";
import { getBullMQConnection } from "../common/redis/redis-connection";
import {
  CRON_QUEUE_NAME,
  CronJobName,
  DEFAULT_CRON_SCHEDULES,
  DEFAULT_CRON_TIMEZONE,
} from "../common/constants/cron.constant";

export class CronQueueService {
  private queue: Queue | null = null;

  constructor() {
    if (envConfig.redis.enabled) {
      this.queue = new Queue(CRON_QUEUE_NAME, {
        connection: getBullMQConnection({
          enableOfflineQueue: false,
          lazyConnect: true,
        }),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: { count: 200 },
          removeOnFail: { count: 1000 },
        },
      });
    }
  }

  getQueue(): Queue | null {
    return this.queue;
  }

  /**
   * Đăng ký hoặc đồng bộ toàn bộ lịch biểu mặc định với BullMQ Schedulers
   */
  async registerDefaultSchedulers(
    jobStatuses: Record<string, boolean>,
  ): Promise<void> {
    if (!this.queue) return;

    for (const name of Object.keys(DEFAULT_CRON_SCHEDULES)) {
      const jobName = name as CronJobName;
      const isEnabled = jobStatuses[jobName] ?? true;

      try {
        if (isEnabled) {
          await this.enableJobScheduler(jobName);
        } else {
          await this.disableJobScheduler(jobName);
        }
      } catch (err) {
        console.warn(
          `[Cron Queue] Failed to register schedule for ${jobName}:`,
          err,
        );
      }
    }
  }

  /**
   * Bật lịch trình chạy định kỳ tự động trong BullMQ Scheduler
   */
  async enableJobScheduler(jobName: CronJobName): Promise<void> {
    if (!this.queue) return;
    const config = DEFAULT_CRON_SCHEDULES[jobName];
    if (!config) return;

    try {
      await this.queue.upsertJobScheduler(
        jobName,
        {
          pattern: config.cron,
          tz: DEFAULT_CRON_TIMEZONE,
        },
        {
          name: jobName,
          data: { params: config.defaultParams },
        },
      );
    } catch (err) {
      console.warn(
        `[Cron Queue] Could not upsert scheduler for ${jobName}:`,
        err,
      );
    }
  }

  /**
   * Tắt lịch trình chạy định kỳ tự động khỏi BullMQ Scheduler
   */
  async disableJobScheduler(jobName: CronJobName): Promise<void> {
    if (!this.queue) return;
    try {
      await this.queue.removeJobScheduler(jobName);
    } catch (err) {
      console.warn(
        `[Cron Queue] Could not remove scheduler for ${jobName}:`,
        err,
      );
    }
  }
}

export const cronQueue = new CronQueueService();
