import { getRedisPublisher, getRedisSubscriber } from "../redis/redis-pubsub";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const AUTH_CACHE_INVALIDATE_CHANNEL = "auth:cache:invalidate";

class AuthorizationCache {
  private readonly permissionCache = new Map<string, CacheEntry<string[]>>();
  private readonly roleCache = new Map<string, CacheEntry<string[]>>();
  private readonly defaultTtlMs = 30 * 1000; // 30 seconds

  getCachedPermissions(userId: string): string[] | null {
    const entry = this.permissionCache.get(userId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.permissionCache.delete(userId);
      return null;
    }
    return entry.data;
  }

  setCachedPermissions(
    userId: string,
    permissions: string[],
    ttlMs: number = this.defaultTtlMs,
  ): void {
    this.permissionCache.set(userId, {
      data: permissions,
      expiresAt: Date.now() + ttlMs,
    });
  }

  getCachedRoles(userId: string): string[] | null {
    const entry = this.roleCache.get(userId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.roleCache.delete(userId);
      return null;
    }
    return entry.data;
  }

  setCachedRoles(
    userId: string,
    roles: string[],
    ttlMs: number = this.defaultTtlMs,
  ): void {
    this.roleCache.set(userId, {
      data: roles,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidateUser(userId: string, propagate = true): void {
    this.permissionCache.delete(userId);
    this.roleCache.delete(userId);

    if (propagate) {
      const publisher = getRedisPublisher();
      if (publisher) {
        publisher
          .publish(
            AUTH_CACHE_INVALIDATE_CHANNEL,
            JSON.stringify({ action: "invalidateUser", userId }),
          )
          .catch(() => {});
      }
    }
  }

  invalidateAll(propagate = true): void {
    this.permissionCache.clear();
    this.roleCache.clear();

    if (propagate) {
      const publisher = getRedisPublisher();
      if (publisher) {
        publisher
          .publish(
            AUTH_CACHE_INVALIDATE_CHANNEL,
            JSON.stringify({ action: "invalidateAll" }),
          )
          .catch(() => {});
      }
    }
  }

  initRedisSubscriber(): void {
    const subscriber = getRedisSubscriber();
    if (!subscriber) return;

    try {
      subscriber.subscribe(AUTH_CACHE_INVALIDATE_CHANNEL, (err) => {
        if (err) {
          console.warn("[AuthCache:RedisSub] Failed to subscribe:", err);
        }
      });

      subscriber.on("message", (channel, message) => {
        if (channel === AUTH_CACHE_INVALIDATE_CHANNEL) {
          try {
            const data = JSON.parse(message);
            if (data.action === "invalidateUser" && data.userId) {
              this.invalidateUser(data.userId, false);
            } else if (data.action === "invalidateAll") {
              this.invalidateAll(false);
            }
          } catch {
            // Ignore malformed messages
          }
        }
      });
    } catch {
      // Ignore failure in degraded mode
    }
  }
}

export const authorizationCache = new AuthorizationCache();

