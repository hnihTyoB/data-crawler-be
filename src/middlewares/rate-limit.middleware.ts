import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { envConfig } from "../config/env.config";
import { ERROR_CODE } from "../common/errors/error-code";
import { systemConfigService } from "../modules/system-config/system-config.service";
import { getRedisClient, isRedisConnected } from "../common/redis/redis-client";

function createRateLimitStore(prefix: string) {
  // If Redis is disabled or not connected/ready, fallback to in-memory store
  if (!isRedisConnected()) {
    return undefined;
  }

  const client = getRedisClient();
  if (!client || (client as any).status !== "ready") {
    return undefined;
  }

  try {
    return new RedisStore({
      // @ts-expect-error - ioredis call signature compatibility
      sendCommand: async (...args: string[]) => {
        if (!isRedisConnected()) {
          throw new Error("Redis connection is closed or not ready");
        }
        return client.call(args[0], ...args.slice(1));
      },
      prefix,
    });
  } catch {
    return undefined;
  }
}

/**
 * Global API rate limit per IP.
 * Tự động sử dụng RedisStore khi REDIS_ENABLED=true và Redis ready,
 * hoặc fallback an toàn sang MemoryStore khi Redis offline.
 */
export const rateLimitMiddleware: RateLimitRequestHandler = rateLimit({
  store: createRateLimitStore("rl:global:"),
  passOnStoreError: true, // Fail-open: Never crash or block API when Redis drops
  windowMs: envConfig.rateLimit.windowMs,
  max: async () =>
    systemConfigService.get<number>(
      "rate_limit.max_requests",
      envConfig.rateLimit.max,
    ),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
    code: ERROR_CODE.RATE_LIMIT_EXCEEDED,
  },
});

export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  store: createRateLimitStore("rl:auth:"),
  passOnStoreError: true, // Fail-open: Never block authentication when Redis drops
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau 1 phút.",
    code: ERROR_CODE.RATE_LIMIT_EXCEEDED,
  },
});

