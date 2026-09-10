import "dotenv/config";
import { Worker } from "bullmq";
import { envConfig } from "../config/env.config";
import { getBullMQConnection } from "../common/redis/redis-connection";
import { cronService } from "../modules/cron/cron.service";
import {
  CRON_QUEUE_NAME,
  CronJobName,
} from "../common/constants/cron.constant";
import { getErrorMessage } from "../common/helpers/error-mapping.helper";

if (!envConfig.redis.enabled) {
  console.log(
    "[Cron Worker] REDIS_ENABLED is not set to true. Cron Worker will not start.",
  );
  process.exit(0);
}

export const cronWorker = new Worker(
  CRON_QUEUE_NAME,
  async (job) => {
    const jobName = job.name as CronJobName;
    console.log(`[Cron Worker] Processing periodic job: ${jobName} (ID: ${job.id})`);

    // 1. Kiểm tra trạng thái bật/tắt của tác vụ từ SystemConfig
    const isEnabled = await cronService.isJobEnabled(jobName);
    if (!isEnabled) {
      console.log(
        `[Cron Worker] Job '${jobName}' is currently DISABLED in system configuration. Skipping execution.`,
      );
      return { skipped: true, reason: "JOB_DISABLED" };
    }

    // 2. Thực thi nghiệp vụ
    try {
      const result = await cronService.executeJob(
        jobName,
        job.data?.params as Record<string, unknown> | undefined,
        { source: "SCHEDULER" },
      );

      if (!result.success) {
        throw new Error(result.error || `Tác vụ '${jobName}' thực thi thất bại`);
      }

      console.log(
        `[Cron Worker] Job '${jobName}' completed successfully in ${result.durationMs}ms`,
      );
      return result;
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      console.error(
        `[Cron Worker] Job '${jobName}' execution failed: ${errorMessage}`,
      );
      throw err;
    }
  },
  {
    connection: getBullMQConnection({
      maxRetriesPerRequest: null,
    }),
    concurrency: 2,
  },
);

cronWorker.on("error", (err) => {
  console.error("[Cron Worker] Error:", err);
});

export async function closeCronWorker() {
  console.log("[Cron Worker] Closing worker gracefully...");
  await cronWorker.close();
  console.log("[Cron Worker] Closed");
}

// Standalone execution
if (require.main === module) {
  const gracefulShutdown = async (signal: string) => {
    console.log(
      `[Cron Worker] Received ${signal}, initiating graceful shutdown...`,
    );
    await closeCronWorker();
    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  console.log("[Cron Worker] Standalone Cron Worker started");
}
