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
});
