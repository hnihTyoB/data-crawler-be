import { RoleService } from "../role.service";
import { RoleRepository } from "../role.repository";
import { AuditLogService } from "../../audit-logs/audit-log.service";
import { AppError } from "../../../common/errors/app-error";
import { SYSTEM_ROLE_SLUGS } from "../../../common/constants/system-role.constant";
import { AUDIT_ACTIONS } from "../../../common/constants/audit-action.constant";

jest.mock("../role.repository");
jest.mock("../../audit-logs/audit-log.service");

describe("RoleService", () => {
  let service: RoleService;
  let repository: jest.Mocked<RoleRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RoleService();
    repository = (service as any).repository;
    auditLogService = (service as any).auditLogService;
  });

  describe("findAll", () => {
    it("should return formatted list with meta", async () => {
      repository.findAll.mockResolvedValue({
        items: [
          {
            id: "role-1",
            name: "Custom Role",
            slug: "custom_role",
            description: "Custom",
            isSystem: false,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            rolePermissions: [],
            _count: { userRoles: 3 },
          } as any,
        ],
        total: 1,
        page: 1,
        limit: 20,
      });

      const result = await service.findAll();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].slug).toBe("custom_role");
      expect(result.items[0].userCount).toBe(3);
      expect(result.meta.total).toBe(1);
    });
  });

  describe("findById", () => {
    it("should return role if exists", async () => {
      repository.findById.mockResolvedValue({
        id: "role-1",
        name: "Admin",
        slug: "admin",
        description: "Admin",
        isSystem: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        rolePermissions: [],
      } as any);

      const result = await service.findById("role-1");
      expect(result.slug).toBe("admin");
    });

    it("should throw 404 if role not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById("non-existent")).rejects.toThrow(AppError);
    });
  });

  describe("create", () => {
    it("should reject creating role with reserved system slug", async () => {
      await expect(
        service.create({
          name: "Super Admin Clone",
          slug: SYSTEM_ROLE_SLUGS.SUPER_ADMIN,
        }),
      ).rejects.toThrow("reserved system slug");
    });

    it("should reject creating duplicate slug", async () => {
      repository.findBySlug.mockResolvedValue({
        id: "r-existing",
        slug: "existing_slug",
      } as any);

      await expect(
        service.create({
          name: "Existing Role",
          slug: "existing_slug",
        }),
      ).rejects.toThrow("already exists");
    });

    it("should create role and log audit", async () => {
      repository.findBySlug.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        id: "r-new",
        name: "Content Manager",
        slug: "content_manager",
        description: "Manages content",
        isSystem: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        rolePermissions: [],
      } as any);

      const result = await service.create(
        {
          name: "Content Manager",
          slug: "content_manager",
          description: "Manages content",
        },
        { actorId: "actor-1" },
      );

      expect(result.slug).toBe("content_manager");
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "actor-1",
          action: AUDIT_ACTIONS.ROLE_CREATED,
        }),
      );
    });
  });

  describe("update", () => {
    it("should reject deactivating a system role", async () => {
      repository.findById.mockResolvedValue({
        id: "r-sys",
        name: "Admin",
        slug: "admin",
        isSystem: true,
        isActive: true,
      } as any);

      await expect(
        service.update("r-sys", { isActive: false }, { actorId: "actor-1" }),
      ).rejects.toThrow("System roles cannot be deactivated");
    });

    it("should update custom role successfully and log audit", async () => {
      repository.findById.mockResolvedValue({
        id: "r-cust",
        name: "Old Name",
        slug: "custom_role",
        isSystem: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        rolePermissions: [],
      } as any);

      repository.update.mockResolvedValue({
        id: "r-cust",
        name: "New Name",
        slug: "custom_role",
        isSystem: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        rolePermissions: [],
      } as any);

      const result = await service.update(
        "r-cust",
        { name: "New Name" },
        { actorId: "actor-1" },
      );

      expect(result.name).toBe("New Name");
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "actor-1",
          action: AUDIT_ACTIONS.ROLE_UPDATED,
        }),
      );
    });
  });

  describe("delete", () => {
    it("should reject deleting a system role", async () => {
      repository.findById.mockResolvedValue({
        id: "r-sys",
        name: "Admin",
        slug: "admin",
        isSystem: true,
      } as any);

      await expect(
        service.delete("r-sys", { actorId: "actor-1" }),
      ).rejects.toThrow("System roles cannot be deleted");
    });

    it("should delete custom role successfully and log audit", async () => {
      repository.findById.mockResolvedValue({
        id: "r-cust",
        name: "Custom Role",
        slug: "custom_role",
        isSystem: false,
      } as any);

      await service.delete("r-cust", { actorId: "actor-1" });

      expect(repository.delete).toHaveBeenCalledWith("r-cust");
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "actor-1",
          action: AUDIT_ACTIONS.ROLE_DELETED,
        }),
      );
    });
  });

  describe("setRolePermissions", () => {
    it("should reject non-super-admin modifying super_admin permissions", async () => {
      repository.findById.mockResolvedValue({
        id: "r-super",
        slug: SYSTEM_ROLE_SLUGS.SUPER_ADMIN,
      } as any);

      await expect(
        service.setRolePermissions(
          "r-super",
          ["p-1"],
          ["admin"], // actor has only 'admin' role
          { actorId: "actor-admin" },
        ),
      ).rejects.toThrow(
        "Only Super Administrators can modify Super Admin permissions",
      );

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "actor-admin",
          action: AUDIT_ACTIONS.PRIVILEGE_ESCALATION_BLOCKED,
        }),
      );
    });

    it("should allow super-admin to modify permissions and log audit", async () => {
      repository.findById.mockResolvedValue({
        id: "r-cust",
        slug: "custom_role",
      } as any);

      repository.setRolePermissions.mockResolvedValue({
        id: "r-cust",
        name: "Custom",
        slug: "custom_role",
        isSystem: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        rolePermissions: [],
      } as any);

      await service.setRolePermissions("r-cust", ["p-1", "p-2"], ["admin"], {
        actorId: "actor-admin",
      });

      expect(repository.setRolePermissions).toHaveBeenCalledWith("r-cust", [
        "p-1",
        "p-2",
      ]);
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "actor-admin",
          action: AUDIT_ACTIONS.PERMISSION_ASSIGNED,
        }),
      );
    });
  });

  describe("resetRoleQuota", () => {
    it("should reset role quota for all assigned users and log audit", async () => {
      repository.findById.mockResolvedValue({
        id: "r-cust",
        slug: "custom_role",
      } as any);

      repository.resetRoleQuota.mockResolvedValue({ count: 5 } as any);

      const result = await service.resetRoleQuota("r-cust", true, {
        actorId: "actor-admin",
      });

      expect(result).toEqual({ affectedUsers: 5 });
      expect(repository.resetRoleQuota).toHaveBeenCalledWith("r-cust", true);
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "actor-admin",
          action: AUDIT_ACTIONS.ROLE_QUOTA_RESET,
          details: expect.objectContaining({
            roleId: "r-cust",
            roleSlug: "custom_role",
            syncLimits: true,
            affectedUsers: 5,
          }),
        }),
      );
    });

    it("should throw 404 if role does not exist", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.resetRoleQuota("non-existent")).rejects.toThrow(
        AppError,
      );
    });
  });
});
