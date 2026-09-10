import { envConfig } from "../../config/env.config";
import type { ConnectionOptions } from "bullmq";
import type { RedisOptions } from "ioredis";

/**
 * Cung cấp tùy chọn kết nối Redis cho ioredis (hỗ trợ cả REDIS_URL và host/port/password)
 */
export function getRedisClientOptions(customOpts: RedisOptions = {}): {
  url?: string;
  options: RedisOptions;
} {
  const isTls = envConfig.redis.url.startsWith("rediss://");
  const commonOpts: RedisOptions = {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 5000,
    retryStrategy: () => null,
    enableOfflineQueue: false,
    ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
    ...customOpts,
  };

  if (envConfig.redis.url) {
    return {
      url: envConfig.redis.url,
      options: commonOpts,
    };
  }

  return {
    options: {
      host: envConfig.redis.host,
      port: envConfig.redis.port,
      password: envConfig.redis.password,
      ...commonOpts,
    },
  };
}

/**
 * Cung cấp ConnectionOptions cho BullMQ Queues và Workers (hỗ trợ cả REDIS_URL và host/port/password)
 */
export function getBullMQConnection(
  extraOpts: Record<string, unknown> = {},
): ConnectionOptions {
  if (envConfig.redis.url) {
    const isTls = envConfig.redis.url.startsWith("rediss://");
    return {
      url: envConfig.redis.url,
      ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
      ...extraOpts,
    };
  }

  return {
    host: envConfig.redis.host,
    port: envConfig.redis.port,
    password: envConfig.redis.password,
    ...extraOpts,
  };
}
