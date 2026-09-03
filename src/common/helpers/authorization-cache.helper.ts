interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class AuthorizationCache {
  private readonly permissionCache = new Map<string, CacheEntry<string[]>>();
  private readonly roleCache = new Map<string, CacheEntry<string[]>>();
  private readonly defaultTtlMs = 60 * 1000; // 60 seconds

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

  invalidateUser(userId: string): void {
    this.permissionCache.delete(userId);
    this.roleCache.delete(userId);
  }

  invalidateAll(): void {
    this.permissionCache.clear();
    this.roleCache.clear();
  }
}

export const authorizationCache = new AuthorizationCache();
