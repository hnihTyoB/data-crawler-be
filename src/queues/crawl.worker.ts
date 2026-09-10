import "dotenv/config";
import { Worker } from "bullmq";
import { envConfig } from "../config/env.config";
import { getBullMQConnection } from "../common/redis/redis-connection";
import { processCrawlJob, withTimeout } from "./crawl.worker.processor";

export let crawlWorker: Worker | null = null;

if (envConfig.redis.enabled) {
  crawlWorker = new Worker(
    "crawl-jobs",
    (job) =>
      withTimeout(
        processCrawlJob(job),
        envConfig.worker.jobTimeoutMs,
        job.data.jobId,
      ),
    {
      connection: getBullMQConnection({
        maxRetriesPerRequest: null,
      }),
      concurrency: envConfig.worker.concurrency,
      maxStalledCount: envConfig.worker.maxStalledCount,
    },
  );

  crawlWorker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
  });

  console.log("[Worker] Crawl worker started");
} else {
  console.log(
    "[Worker] REDIS_ENABLED is not set to true. Worker will not start.",
  );
}

async function gracefulShutdown(signal: string) {
  if (crawlWorker) {
    console.log(`[Worker] Received ${signal}, closing worker gracefully...`);
    await crawlWorker.close();
    console.log("[Worker] Worker closed");
  }
  process.exit(0);
}

process.on("SIGTERM", async () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", async () => gracefulShutdown("SIGINT"));

