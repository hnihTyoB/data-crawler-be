import { UserService } from "../../users/user.service";
import { UserRepository } from "../../users/user.repository";
import { RoleRepository } from "../role.repository";
import { AuditLogService } from "../../audit-logs/audit-log.service";
import { SYSTEM_ROLE_SLUGS } from "../../../common/constants/system-role.constant";
import { AUDIT_ACTIONS } from "../../../common/constants/audit-action.constant";

jest.mock("../../users/user.repository");
jest.mock("../role.repository");
jest.mock("../../audit-logs/audit-log.service");

describe("Privilege Escalation Defense Suite", () => {
  let userService: UserService;
  let userRepository: jest.Mocked<UserRepository>;
  let roleRepository: jest.Mocked<RoleRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  const superAdminRole = {
    id: "role-super-admin-id",
    name: "Super Administrator",
    slug: SYSTEM_ROLE_SLUGS.SUPER_ADMIN,
    isSystem: true,
  };

  const adminRole = {
    id: "role-admin-id",
    name: "Administrator",
    slug: SYSTEM_ROLE_SLUGS.ADMIN,
    isSystem: true,
  };

  const customRole = {
    id: "role-custom-id",
    name: "Custom Manager",
    slug: "custom_manager",
    isSystem: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userService = new UserService();
    userRepository = (userService as any).repository;
    roleRepository = (userService as any).roleRepository;
    auditLogService = (userService as any).auditLogService;
  });

  describe("1. Self Privilege Escalation Defense", () => {
    it("denies user attempting to assign roles to self via assignUserRoles", async () => {
      await expect(
        userService.assignUserRoles(
          "user-1", // actorId
          ["admin"], // actorRoles
          "user-1", // targetUserId (same as actor)
          [adminRole.id],
          { actorId: "user-1" },
        ),
      ).rejects.toThrow("cannot modify your own roles");

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          action: AUDIT_ACTIONS.PRIVILEGE_ESCALATION_BLOCKED,
        }),
      );
      expect(userRepository.assignUserRoles).not.toHaveBeenCalled();
    });

    it("denies user attempting to assign a single role to self", async () => {
      await expect(
        userService.assignSingleRole(
          "user-1",
          ["crawler_user"],
          "user-1",
          adminRole.id,
          { actorId: "user-1" },
        ),
      ).rejects.toThrow("cannot assign roles to yourself");

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          action: AUDIT_ACTIONS.PRIVILEGE_ESCALATION_BLOCKED,
        }),
      );
    });

    it("denies user attempting to revoke a role from self", async () => {
      await expect(
        userService.revokeSingleRole(
          "user-1",
          ["admin"],
          "user-1",
          adminRole.id,
        ),
      ).rejects.toThrow("cannot revoke roles from yourself");
    });
  });

  describe("2. Super Admin Isolation Defense", () => {
    it("denies regular admin attempting to assign Super Admin role to another user", async () => {
      userRepository.findById.mockResolvedValue({
        id: "user-target",
        email: "target@example.com",
      } as any);

      roleRepository.findById.mockResolvedValue(superAdminRole as any);

      await expect(
        userService.assignSingleRole(
          "actor-admin",
          ["admin"], // not super_admin
          "user-target",
          superAdminRole.id,
          { actorId: "actor-admin" },
        ),
      ).rejects.toThrow(
        "Only Super Administrators can assign the Super Admin role",
      );

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "actor-admin",
          action: AUDIT_ACTIONS.SUPER_ADMIN_ASSIGN_ATTEMPT,
        }),
      );
      expect(userRepository.assignSingleRole).not.toHaveBeenCalled();
    });

    it("denies regular admin attempting to modify roles of an existing Super Admin", async () => {
      userRepository.findById.mockResolvedValue({
        id: "user-super-target",
        email: "super@example.com",
      } as any);

      roleRepository.findById.mockResolvedValue(customRole as any);
      userRepository.isUserSuperAdmin.mockResolvedValue(true);

      await expect(
        userService.assignSingleRole(
          "actor-admin",
          ["admin"],
          "user-super-target",
          customRole.id,
        ),
      ).rejects.toThrow(
        "Only Super Administrators can modify roles of a Super Administrator",
      );
    });

    it("denies regular admin attempting to delete a Super Admin user", async () => {
      userRepository.findById.mockResolvedValue({
        id: "user-super-target",
      } as any);
      userRepository.isUserSuperAdmin.mockResolvedValue(true);

      await expect(
        userService.delete("user-super-target", "actor-admin", ["admin"]),
      ).rejects.toThrow(
        "Only Super Administrators can delete a Super Administrator account",
      );

      expect(userRepository.delete).not.toHaveBeenCalled();
    });

    it("denies regular admin attempting to deactivate a Super Admin user", async () => {
      userRepository.findById.mockResolvedValue({
        id: "user-super-target",
      } as any);
      userRepository.isUserSuperAdmin.mockResolvedValue(true);

      await expect(
        userService.update(
          "user-super-target",
          { isActive: false },
          "actor-admin",
          ["admin"],
        ),
      ).rejects.toThrow(
        "Only Super Administrators can modify a Super Administrator account",
      );
    });
  });

  describe("3. Last Active Super Admin Protection", () => {
    it("prevents revoking the last active Super Admin role", async () => {
      userRepository.findById.mockResolvedValue({
        id: "target-super-1",
      } as any);
      roleRepository.findById.mockResolvedValue(superAdminRole as any);
      userRepository.isUserSuperAdmin.mockResolvedValue(true);
      userRepository.countActiveSuperAdmins.mockResolvedValue(1); // Only 1 active super admin left

      await expect(
        userService.revokeSingleRole(
          "actor-super-2",
          [SYSTEM_ROLE_SLUGS.SUPER_ADMIN],
          "target-super-1",
          superAdminRole.id,
        ),
      ).rejects.toThrow("Cannot revoke the last active Super Admin role");

      expect(userRepository.revokeSingleRole).not.toHaveBeenCalled();
    });

    it("prevents deleting the last active Super Admin account", async () => {
      userRepository.findById.mockResolvedValue({
        id: "target-super-1",
      } as any);
      userRepository.isUserSuperAdmin.mockResolvedValue(true);
      userRepository.countActiveSuperAdmins.mockResolvedValue(1);

      await expect(
        userService.delete("target-super-1", "actor-super-2", [
          SYSTEM_ROLE_SLUGS.SUPER_ADMIN,
        ]),
      ).rejects.toThrow("Cannot delete the last active Super Admin account");

      expect(userRepository.delete).not.toHaveBeenCalled();
    });

    it("prevents deactivating the last active Super Admin account", async () => {
      userRepository.findById.mockResolvedValue({
        id: "target-super-1",
      } as any);
      userRepository.isUserSuperAdmin.mockResolvedValue(true);
      userRepository.countActiveSuperAdmins.mockResolvedValue(1);

      await expect(
        userService.update(
          "target-super-1",
          { isActive: false },
          "actor-super-2",
          [SYSTEM_ROLE_SLUGS.SUPER_ADMIN],
        ),
      ).rejects.toThrow(
        "Cannot deactivate the last active Super Admin account",
      );
    });
  });

  describe("4. Legitimate Super Admin & Admin Operations", () => {
    it("allows Super Admin to assign Super Admin role when multiple exist", async () => {
      userRepository.findById.mockResolvedValue({
        id: "user-target",
      } as any);
      roleRepository.findById.mockResolvedValue(superAdminRole as any);
      userRepository.isUserSuperAdmin.mockResolvedValue(false);
      userRepository.assignSingleRole.mockResolvedValue({
        userId: "user-target",
        roleId: superAdminRole.id,
      } as any);

      const result = await userService.assignSingleRole(
        "actor-super",
        [SYSTEM_ROLE_SLUGS.SUPER_ADMIN],
        "user-target",
        superAdminRole.id,
        { actorId: "actor-super" },
      );

      expect(result).toBeDefined();
      expect(userRepository.assignSingleRole).toHaveBeenCalledWith(
        "user-target",
        superAdminRole.id,
        "actor-super",
      );
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "actor-super",
          action: AUDIT_ACTIONS.ROLE_ASSIGNED,
        }),
      );
    });

    it("allows Admin to assign custom role to user", async () => {
      userRepository.findById.mockResolvedValue({
        id: "user-target",
      } as any);
      roleRepository.findById.mockResolvedValue(customRole as any);
      userRepository.isUserSuperAdmin.mockResolvedValue(false);
      userRepository.assignSingleRole.mockResolvedValue({
        userId: "user-target",
        roleId: customRole.id,
      } as any);

      const result = await userService.assignSingleRole(
        "actor-admin",
        ["admin"],
        "user-target",
        customRole.id,
        { actorId: "actor-admin" },
      );

      expect(result).toBeDefined();
      expect(userRepository.assignSingleRole).toHaveBeenCalledWith(
        "user-target",
        customRole.id,
        "actor-admin",
      );
    });
  });
});
