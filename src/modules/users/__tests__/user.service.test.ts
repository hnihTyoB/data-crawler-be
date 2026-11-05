import { UserService } from "../user.service";

describe("UserService admin role guard", () => {
  const admin = {
    id: "admin-1",
    email: "admin@example.com",
    fullName: "Admin",
    role: "ADMIN",
    isActive: true,
    maxPagesLimit: 100,
    maxJobsPerDayLimit: 10,
    maxConcurrentJobsLimit: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("rejects changing the role of an existing admin account", async () => {
    const service = new UserService();
    const repository = {
      findById: jest.fn().mockResolvedValue(admin),
      update: jest.fn(),
    };
    (service as unknown as { repository: typeof repository }).repository =
      repository;

    await expect(service.update(admin.id, { role: "VIEWER" })).rejects.toThrow(
      "Không thể thay đổi vai trò của tài khoản Admin",
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("resets user quota successfully and logs audit event", async () => {
    const service = new UserService();
    const repository = {
      findById: jest.fn().mockResolvedValue(admin),
      resetQuota: jest.fn().mockResolvedValue({
        ...admin,
        quotaResetAt: new Date(),
      }),
    };
    const auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    (service as any).repository = repository;
    (service as any).auditLogService = auditLogService;

    const result = await service.resetQuota(admin.id, true, {
      actorId: "superadmin-1",
      ipAddress: "127.0.0.1",
      userAgent: "jest",
    });

    expect(repository.resetQuota).toHaveBeenCalledWith(admin.id, true);
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "superadmin-1",
        action: "USER_QUOTA_RESET",
        details: expect.objectContaining({
          targetUserId: admin.id,
          resetLimitsToRole: true,
        }),
      }),
    );
    expect(result.id).toBe(admin.id);
  });

  describe("Privilege Escalation Defense (SEC-03)", () => {
    const regularUser = {
      id: "user-1",
      email: "user@example.com",
      fullName: "Regular User",
      role: "CRAWLER_USER",
      isActive: true,
      maxPagesLimit: 50,
      maxJobsPerDayLimit: 5,
      maxConcurrentJobsLimit: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("rejects user attempting to change their own role (self-escalation blocked)", async () => {
      const service = new UserService();
      const repository = {
        findById: jest.fn().mockResolvedValue(regularUser),
        update: jest.fn(),
      };
      const auditLogService = { log: jest.fn().mockResolvedValue(undefined) };
      (service as any).repository = repository;
      (service as any).auditLogService = auditLogService;

      await expect(
        service.update(
          regularUser.id,
          { role: "ADMIN" },
          regularUser.id,
          ["crawler_user"],
        ),
      ).rejects.toThrow("Forbidden: You cannot modify your own role.");

      expect(repository.update).not.toHaveBeenCalled();
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: regularUser.id,
          action: "PRIVILEGE_ESCALATION_BLOCKED",
        }),
      );
    });

    it("rejects non-admin actor attempting to modify another user's role", async () => {
      const service = new UserService();
      const repository = {
        findById: jest.fn().mockResolvedValue(regularUser),
        update: jest.fn(),
      };
      const auditLogService = { log: jest.fn().mockResolvedValue(undefined) };
      (service as any).repository = repository;
      (service as any).auditLogService = auditLogService;

      await expect(
        service.update(
          regularUser.id,
          { role: "ADMIN" },
          "operator-1",
          ["custom_operator"],
        ),
      ).rejects.toThrow("Forbidden: Only Administrators can modify user roles.");

      expect(repository.update).not.toHaveBeenCalled();
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "operator-1",
          action: "PRIVILEGE_ESCALATION_BLOCKED",
        }),
      );
    });

    it("allows Administrator to modify another user's role", async () => {
      const service = new UserService();
      const updatedUser = { ...regularUser, role: "VIEWER" };
      const repository = {
        findById: jest.fn().mockResolvedValue(regularUser),
        update: jest.fn().mockResolvedValue(updatedUser),
        assignSingleRole: jest.fn().mockResolvedValue(undefined),
      };
      const roleRepository = {
        findBySlug: jest.fn().mockResolvedValue({ id: "role-viewer", slug: "viewer" }),
      };
      (service as any).repository = repository;
      (service as any).roleRepository = roleRepository;

      const result = await service.update(
        regularUser.id,
        { role: "VIEWER" },
        "admin-1",
        ["admin"],
      );

      expect(repository.update).toHaveBeenCalledWith(
        regularUser.id,
        expect.objectContaining({ role: "VIEWER" }),
      );
      expect(repository.assignSingleRole).toHaveBeenCalledWith(
        regularUser.id,
        "role-viewer",
        "admin-1",
      );
      expect(result.role).toBe("VIEWER");
    });

    it("allows user to update their own profile when role is unchanged", async () => {
      const service = new UserService();
      const updatedUser = { ...regularUser, fullName: "Updated Name" };
      const repository = {
        findById: jest.fn().mockResolvedValue(regularUser),
        update: jest.fn().mockResolvedValue(updatedUser),
      };
      (service as any).repository = repository;

      const result = await service.update(
        regularUser.id,
        { fullName: "Updated Name", role: "CRAWLER_USER" },
        regularUser.id,
        ["crawler_user"],
      );

      expect(repository.update).toHaveBeenCalledWith(
        regularUser.id,
        expect.objectContaining({ fullName: "Updated Name" }),
      );
      expect(result.fullName).toBe("Updated Name");
    });
  });
});
