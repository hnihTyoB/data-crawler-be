import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { envConfig } from '../config/env.config';

/**
 * Global API rate limit per IP, configurable for each environment.
 * Dùng in-memory store (MemoryStore) phù hợp cho single-instance dev/staging.
 * Khi scale multi-instance, swap store sang RedisStore (rate-limit-redis).
 */
export const rateLimitMiddleware: RateLimitRequestHandler = rateLimit({
  windowMs: envConfig.rateLimit.windowMs,
  max: envConfig.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});
