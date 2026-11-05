import { authorizationCache } from "../authorization-cache.helper";
import * as redisClient from "../../redis/redis-client";
import { envConfig } from "../../../config/env.config";

jest.mock("../../redis/redis-client");

describe("AuthorizationCache Security Patches (SEC-27)", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRedisEnabled = envConfig.redis.enabled;

  beforeEach(() => {
    authorizationCache.invalidateAll();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    (envConfig.redis as any).enabled = originalRedisEnabled;
  });

  it("caches and returns permissions and roles in development/test environment", () => {
    process.env.NODE_ENV = "test";
    authorizationCache.setCachedPermissions("user-1", ["users.read"]);
    authorizationCache.setCachedRoles("user-1", ["crawler_user"]);

    expect(authorizationCache.getCachedPermissions("user-1")).toEqual(["users.read"]);
    expect(authorizationCache.getCachedRoles("user-1")).toEqual(["crawler_user"]);
  });

  it("bypasses local cache in production when Redis is disabled to prevent cross-node desync (SEC-27)", () => {
    process.env.NODE_ENV = "production";
    (envConfig.redis as any).enabled = false;

    authorizationCache.setCachedPermissions("user-1", ["users.read"]);
    authorizationCache.setCachedRoles("user-1", ["crawler_user"]);

    // Must return null so caller reads directly from DB (preventing stale authorization)
    expect(authorizationCache.getCachedPermissions("user-1")).toBeNull();
    expect(authorizationCache.getCachedRoles("user-1")).toBeNull();
  });

  it("bypasses local cache in production when Redis is enabled but disconnected (SEC-27)", () => {
    process.env.NODE_ENV = "production";
    (envConfig.redis as any).enabled = true;
    (redisClient.isRedisConnected as jest.Mock).mockReturnValue(false);

    authorizationCache.setCachedPermissions("user-2", ["admin"]);

    expect(authorizationCache.getCachedPermissions("user-2")).toBeNull();
  });

  it("allows caching in production when Redis is enabled and connected", () => {
    process.env.NODE_ENV = "production";
    (envConfig.redis as any).enabled = true;
    (redisClient.isRedisConnected as jest.Mock).mockReturnValue(true);

    authorizationCache.setCachedPermissions("user-3", ["crawl_jobs.create"]);

    expect(authorizationCache.getCachedPermissions("user-3")).toEqual(["crawl_jobs.create"]);
  });
});
