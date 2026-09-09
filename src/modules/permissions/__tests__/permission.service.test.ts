import { PermissionService } from "../permission.service";
import { PermissionRepository } from "../permission.repository";
import { authorizationCache } from "../../../common/helpers/authorization-cache.helper";
import { AppError } from "../../../common/errors/app-error";

jest.mock("../permission.repository");

describe("PermissionService", () => {
  let service: PermissionService;
  let repository: jest.Mocked<PermissionRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    authorizationCache.invalidateAll();
    service = new PermissionService();
    repository = (service as any).repository;
  });

  describe("findAll", () => {
    it("should return formatted permission list", async () => {
      const mockPermissions = [
        {
          id: "p-1",
          name: "Read Users",
          slug: "users.read",
          description: "Read user list",
          resource: "users",
          action: "read",
          isSystem: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      repository.findAll.mockResolvedValue(mockPermissions as any);

      const result = await service.findAll({ resource: "users" });

      expect(repository.findAll).toHaveBeenCalledWith({ resource: "users" });
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe("users.read");
    });
  });

  describe("findById", () => {
    it("should return permission if found", async () => {
      const mockPermission = {
        id: "p-1",
        name: "Read Users",
        slug: "users.read",
        description: "Read user list",
        resource: "users",
        action: "read",
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.findById.mockResolvedValue(mockPermission as any);

      const result = await service.findById("p-1");
      expect(result.slug).toBe("users.read");
    });

    it("should throw AppError 404 if permission not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById("non-existing")).rejects.toThrow(AppError);
    });
  });

  describe("getUserPermissions and caching", () => {
    it("should fetch from repository on cache miss and cache result", async () => {
      repository.findUserPermissions.mockResolvedValue([
        "users.read",
        "roles.read",
      ]);

      const perms1 = await service.getUserPermissions("user-1");
      expect(perms1).toEqual(["users.read", "roles.read"]);
      expect(repository.findUserPermissions).toHaveBeenCalledTimes(1);

      // Second call should hit cache
      const perms2 = await service.getUserPermissions("user-1");
      expect(perms2).toEqual(["users.read", "roles.read"]);
      expect(repository.findUserPermissions).toHaveBeenCalledTimes(1);
    });

    it("should fetch from repository again after cache invalidation", async () => {
      repository.findUserPermissions.mockResolvedValue(["users.read"]);

      await service.getUserPermissions("user-1");
      authorizationCache.invalidateUser("user-1");
      await service.getUserPermissions("user-1");

      expect(repository.findUserPermissions).toHaveBeenCalledTimes(2);
    });
  });

  describe("getUserRoles and caching", () => {
    it("should fetch user role slugs and cache result", async () => {
      repository.findUserRoleSlugs.mockResolvedValue(["admin", "crawler_user"]);

      const roles1 = await service.getUserRoles("user-1");
      expect(roles1).toEqual(["admin", "crawler_user"]);
      expect(repository.findUserRoleSlugs).toHaveBeenCalledTimes(1);

      const roles2 = await service.getUserRoles("user-1");
      expect(roles2).toEqual(["admin", "crawler_user"]);
      expect(repository.findUserRoleSlugs).toHaveBeenCalledTimes(1);
    });
  });

  describe("ensureSystemPermissions", () => {
    it("should call repository.ensureSystemPermissions and invalidate cache", async () => {
      repository.ensureSystemPermissions = jest.fn().mockResolvedValue(undefined);
      const invalidateSpy = jest.spyOn(authorizationCache, "invalidateAll");

      await service.ensureSystemPermissions();

      expect(repository.ensureSystemPermissions).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledTimes(1);
    });
  });
});
