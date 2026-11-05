import crypto from "crypto";
import { getRedisClient, isRedisConnected } from "../redis/redis-client";

// In-memory fallback stores when Redis is offline or disabled
const localTokenBlocklist = new Map<string, number>();
const localUserRevokedAt = new Map<string, number>();

// Clean up expired local tokens every 5 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, exp] of localTokenBlocklist.entries()) {
    if (now > exp) {
      localTokenBlocklist.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Revokes a specific access token (e.g. during logout).
 * @param token Raw JWT access token
 * @param ttlSeconds TTL in seconds (defaults to 24h = 86400s)
 */
export async function revokeToken(
  token: string,
  ttlSeconds = 86400,
): Promise<void> {
  if (!token) return;
  const tokenHash = hashToken(token);

  if (isRedisConnected()) {
    const client = getRedisClient();
    if (client) {
      try {
        await client.set(`token:blocklist:${tokenHash}`, "1", "EX", ttlSeconds);
        return;
      } catch {
        // Fallback to local memory on Redis error
      }
    }
  }

  localTokenBlocklist.set(tokenHash, Date.now() + ttlSeconds * 1000);
}

/**
 * Revokes all tokens for a user issued before the current timestamp (e.g. on logout, password change, reset).
 * @param userId User ID
 * @param ttlSeconds TTL in seconds (defaults to 24h = 86400s)
 */
export async function revokeUserTokens(
  userId: string,
  ttlSeconds = 86400,
  revokedAt?: number,
): Promise<void> {
  if (!userId) return;
  const nowSeconds = revokedAt ?? Math.floor(Date.now() / 1000);

  if (isRedisConnected()) {
    const client = getRedisClient();
    if (client) {
      try {
        await client.set(
          `user:revoked_at:${userId}`,
          String(nowSeconds),
          "EX",
          ttlSeconds,
        );
        return;
      } catch {
        // Fallback to local memory on Redis error
      }
    }
  }

  localUserRevokedAt.set(userId, nowSeconds);
}

/**
 * Checks whether an access token is revoked either individually or via user-wide revocation.
 */
export async function isTokenRevoked(
  token: string,
  userId: string,
  iat?: number,
): Promise<boolean> {
  if (!token) return true;
  const tokenHash = hashToken(token);

  // 1. Check individual token blocklist
  if (isRedisConnected()) {
    const client = getRedisClient();
    if (client) {
      try {
        const isBlocked = await client.exists(`token:blocklist:${tokenHash}`);
        if (isBlocked === 1) return true;
      } catch {
        // Fallback to local check
      }
    }
  }

  const localBlockExp = localTokenBlocklist.get(tokenHash);
  if (localBlockExp && Date.now() < localBlockExp) {
    return true;
  }

  // 2. Check user-level revocation timestamp (password change / reset / logout)
  if (userId && typeof iat === "number") {
    let revokedAtSeconds: number | null = null;

    if (isRedisConnected()) {
      const client = getRedisClient();
      if (client) {
        try {
          const val = await client.get(`user:revoked_at:${userId}`);
          if (val) {
            revokedAtSeconds = parseInt(val, 10);
          }
        } catch {
          // Fallback to local check
        }
      }
    }

    if (revokedAtSeconds === null) {
      revokedAtSeconds = localUserRevokedAt.get(userId) ?? null;
    }

    if (revokedAtSeconds !== null && iat < revokedAtSeconds) {
      return true;
    }
  }

  return false;
}

/**
 * Helper to clear local blocklists (primarily for test suite isolation).
 */
export function clearLocalTokenBlocklist(): void {
  localTokenBlocklist.clear();
  localUserRevokedAt.clear();
}
