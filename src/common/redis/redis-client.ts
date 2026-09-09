import Redis from "ioredis";
import { envConfig } from "../../config/env.config";

let generalClient: Redis | null = null;

export function isRedisConnected(): boolean {
  if (!envConfig.redis.enabled || !generalClient) return false;
  return (generalClient as any).status === "ready";
}

/**
 * Cung cấp Redis client dùng chung cho toàn bộ ứng dụng (Rate Limiter, Distributed Locks).
 * Trả về null nếu REDIS_ENABLED=false hoặc không khởi tạo được.
 */
export function getRedisClient(): Redis | null {
  if (!envConfig.redis.enabled) return null;

  if (
    generalClient &&
    ((generalClient as any).status === "end" ||
      (generalClient as any).status === "close")
  ) {
    generalClient = null;
  }

  if (!generalClient) {
    try {
      generalClient = new Redis({
        host: envConfig.redis.host,
        port: envConfig.redis.port,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        connectTimeout: 2000,
        retryStrategy: () => null,
        enableOfflineQueue: false,
      });

      generalClient.on("error", () => {
        // Suppress unhandled crash logs on reconnect/timeout
      });
    } catch {
      generalClient = null;
    }
  }

  return generalClient;
}

async function ensureConnected(client: Redis): Promise<boolean> {
  const getStatus = (): string => (client as any).status;
  if (getStatus() === "ready") return true;
  if (getStatus() === "wait") {
    try {
      await client.connect();
      return getStatus() === "ready";
    } catch {
      return false;
    }
  }
  if (getStatus() === "connecting" || getStatus() === "connect") {
    let attempts = 0;
    while (getStatus() !== "ready" && attempts < 10) {
      await new Promise((r) => setTimeout(r, 50));
      attempts++;
    }
    return getStatus() === "ready";
  }
  return false;
}

/**
 * Khởi tạo và kết nối Redis client dùng chung khi ứng dụng khởi động.
 */
export async function initRedisClient(): Promise<Redis | null> {
  const client = getRedisClient();
  if (!client) return null;
  const ready = await ensureConnected(client);
  if (!ready) {
    try {
      client.disconnect();
    } catch {
      // Bỏ qua lỗi ngắt kết nối
    }
    generalClient = null;
    return null;
  }
  return client;
}

import crypto from "crypto";

const localLocks = new Map<string, string>();

const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

/**
 * Thu nhận khóa phân tán Redis bằng SET NX PX với Token ngẫu nhiên (chống lock hijacking).
 * Nếu Redis tắt hoặc lỗi kết nối, tự động fallback an toàn sang in-memory mutex cục bộ.
 */
export async function acquireDistributedLock(
  lockKey: string,
  ttlMs: number = 5000,
  customToken?: string,
): Promise<string | false> {
  const token = customToken || crypto.randomUUID();
  const client = getRedisClient();
  if (client) {
    try {
      const ready = await ensureConnected(client);
      if (ready) {
        const acquired = await client.set(lockKey, token, "PX", ttlMs, "NX");
        return acquired === "OK" ? token : false;
      }
    } catch {
      // Fallback cục bộ khi Redis lỗi mạng
    }
  }

  if (localLocks.has(lockKey)) {
    return false;
  }
  localLocks.set(lockKey, token);
  setTimeout(() => {
    if (localLocks.get(lockKey) === token) {
      localLocks.delete(lockKey);
    }
  }, ttlMs);
  return token;
}

/**
 * Giải phóng khóa phân tán Redis an toàn qua Lua script (chỉ xóa nếu đúng Token sở hữu).
 */
export async function releaseDistributedLock(
  lockKey: string,
  token?: string,
): Promise<void> {
  const client = getRedisClient();
  if (client) {
    try {
      const ready = await ensureConnected(client);
      if (ready) {
        if (token) {
          await client.eval(RELEASE_LOCK_LUA, 1, lockKey, token);
        } else {
          await client.del(lockKey);
        }
      }
    } catch {
      // Bỏ qua lỗi khi Redis offline
    }
  }
  if (!token || localLocks.get(lockKey) === token) {
    localLocks.delete(lockKey);
  }
}

