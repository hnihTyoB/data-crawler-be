import 'dotenv/config';
import { Worker } from 'bullmq';
import { envConfig } from '../config/env.config';
import { processCrawlJob, withTimeout } from './crawl.worker.processor';

if (!envConfig.redis.enabled) {
  console.log('[Worker] REDIS_ENABLED is not set to true. Worker will not start.');
  process.exit(0);
}

const worker = new Worker(
  'crawl-jobs',
  (job) => withTimeout(processCrawlJob(job), envConfig.worker.jobTimeoutMs, job.data.jobId),
  {
    connection: {
      host: envConfig.redis.host,
      port: envConfig.redis.port,
      maxRetriesPerRequest: null,
    },
    concurrency: envConfig.worker.concurrency,
    maxStalledCount: envConfig.worker.maxStalledCount,
  },
);

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
});

async function gracefulShutdown(signal: string) {
  console.log(`[Worker] Received ${signal}, closing worker gracefully...`);
  await worker.close();
  console.log('[Worker] Worker closed');
  process.exit(0);
}

process.on('SIGTERM', async () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', async () => gracefulShutdown('SIGINT'));

console.log('[Worker] Crawl worker started');