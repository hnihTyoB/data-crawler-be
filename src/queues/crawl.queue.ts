import { Queue } from "bullmq";
import { envConfig } from "../config/env.config";
import { getBullMQConnection } from "../common/redis/redis-connection";

export const crawlQueue = envConfig.redis.enabled
  ? new Queue("crawl-jobs", {
      connection: getBullMQConnection({
        enableOfflineQueue: false,
        lazyConnect: true,
      }),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 10000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    })
  : null;
