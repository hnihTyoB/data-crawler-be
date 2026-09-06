import { AuthService } from "../auth.service";

describe("AuthService email verification", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = "production";
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  const inactiveUser = {
    id: "user-1",
    email: "new@example.com",
    fullName: "New User",
    role: "CRAWLER_USER",
    isActive: false,
    passwordHash: "hash",
    createdAt: new Date(),
  };

  it("reports that a verification email was actually resent to an inactive account", async () => {
    const service = new AuthService();
    const repository = {
      findByEmail: jest.fn().mockResolvedValue(inactiveUser),
    };
    const mailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };
    const mutableService = service as unknown as {
      repository: typeof repository;
      mailService: typeof mailService;
    };
    mutableService.repository = repository;
    mutableService.mailService = mailService;

    const result = await service.resendVerificationEmail(inactiveUser.email);

    expect(result).toEqual({
      success: true,
      sent: true,
      userId: inactiveUser.id,
    });
    expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it("does not claim a resend occurred for an active account", async () => {
    const service = new AuthService();
    const repository = {
      findByEmail: jest
        .fn()
        .mockResolvedValue({ ...inactiveUser, isActive: true }),
    };
    const mailService = {
      sendVerificationEmail: jest.fn(),
    };
    const mutableService = service as unknown as {
      repository: typeof repository;
      mailService: typeof mailService;
    };
    mutableService.repository = repository;
    mutableService.mailService = mailService;

    const result = await service.resendVerificationEmail(inactiveUser.email);

    expect(result).toEqual({ success: true, sent: false });
    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe("AuthService profile updates", () => {
  it("rejects a no-op name update before writing to the repository", async () => {
    const service = new AuthService();
    const user = {
      id: "user-1",
      email: "user@example.com",
      fullName: "Nguyễn Văn A",
      role: "CRAWLER_USER",
      isActive: true,
      createdAt: new Date(),
    };
    const repository = {
      findById: jest.fn().mockResolvedValue(user),
      updateUser: jest.fn(),
    };
    (service as unknown as { repository: typeof repository }).repository =
      repository;

    await expect(
      service.updateMe(user.id, { fullName: ` ${user.fullName} ` }),
    ).rejects.toThrow("Không có thay đổi nào để cập nhật");
    expect(repository.updateUser).not.toHaveBeenCalled();
  });
});

describe("AuthService registration mail failures", () => {
  const inactiveUser = {
    id: "new-user",
    email: "new@example.com",
    fullName: "New User",
    role: "CRAWLER_USER",
    isActive: false,
    passwordHash: "hash",
    createdAt: new Date(),
  };

  it("rolls back a newly-created inactive user when verification delivery fails", async () => {
    const service = new AuthService();
    const repository = {
      findByEmail: jest.fn().mockResolvedValue(null),
      createUser: jest.fn().mockResolvedValue(inactiveUser),
      deleteUnverifiedUser: jest.fn().mockResolvedValue(undefined),
    };
    const mailService = {
      sendVerificationEmail: jest.fn().mockRejectedValue(
        Object.assign(new Error("Invalid login"), {
          code: "EAUTH",
          responseCode: 535,
        }),
      ),
    };
    const mutableService = service as unknown as {
      repository: typeof repository;
      mailService: typeof mailService;
    };
    mutableService.repository = repository;
    mutableService.mailService = mailService;

    await expect(
      service.register({
        email: inactiveUser.email,
        password: "Valid@123",
        fullName: inactiveUser.fullName,
      }),
    ).rejects.toMatchObject({
      message: "Không thể gửi email xác thực. Vui lòng thử lại sau.",
      statusCode: 503,
      code: "MAIL_DELIVERY_FAILED",
    });
    expect(repository.deleteUnverifiedUser).toHaveBeenCalledWith(
      inactiveUser.id,
    );
  });

  it("resends verification instead of rejecting an existing inactive account", async () => {
    const service = new AuthService();
    const repository = {
      findByEmail: jest.fn().mockResolvedValue(inactiveUser),
      createUser: jest.fn(),
    };
    const mailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };
    const mutableService = service as unknown as {
      repository: typeof repository;
      mailService: typeof mailService;
    };
    mutableService.repository = repository;
    mutableService.mailService = mailService;

    const result = await service.register({
      email: inactiveUser.email,
      password: "Valid@123",
      fullName: inactiveUser.fullName,
    });

    expect(result.id).toBe(inactiveUser.id);
    expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(repository.createUser).not.toHaveBeenCalled();
  });

  describe("AuthService forgotPassword security", () => {
    const activeUser = {
      id: "user-active",
      email: "active@example.com",
      fullName: "Active User",
      role: "CRAWLER_USER",
      isActive: true,
      passwordHash: "hash",
      createdAt: new Date(),
    };

    it("sends password reset email internally and returns only { success: true } without leaking token or userId", async () => {
      const service = new AuthService();
      const repository = {
        findByEmail: jest.fn().mockResolvedValue(activeUser),
      };
      const mailService = {
        sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      };
      const mutableService = service as unknown as {
        repository: typeof repository;
        mailService: typeof mailService;
      };
      mutableService.repository = repository;
      mutableService.mailService = mailService;

      const result = await service.forgotPassword({ email: activeUser.email });

      expect(result).toEqual({ success: true });
      expect((result as Record<string, unknown>).resetToken).toBeUndefined();
      expect((result as Record<string, unknown>).userId).toBeUndefined();
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        activeUser.email,
        expect.any(String),
      );
    });

    it("throws 404 NOT_FOUND and does not call mail service if user is not found", async () => {
      const service = new AuthService();
      const repository = {
        findByEmail: jest.fn().mockResolvedValue(null),
      };
      const mailService = {
        sendPasswordResetEmail: jest.fn(),
      };
      const mutableService = service as unknown as {
        repository: typeof repository;
        mailService: typeof mailService;
      };
      mutableService.repository = repository;
      mutableService.mailService = mailService;

      await expect(
        service.forgotPassword({
          email: "nonexistent@example.com",
        })
      ).rejects.toThrow("Email không tồn tại trong hệ thống.");
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("throws 403 USER_INACTIVE and does not call mail service if user is inactive", async () => {
      const service = new AuthService();
      const repository = {
        findByEmail: jest
          .fn()
          .mockResolvedValue({ ...activeUser, isActive: false }),
      };
      const mailService = {
        sendPasswordResetEmail: jest.fn(),
      };
      const mutableService = service as unknown as {
        repository: typeof repository;
        mailService: typeof mailService;
      };
      mutableService.repository = repository;
      mutableService.mailService = mailService;

      await expect(
        service.forgotPassword({ email: activeUser.email })
      ).rejects.toThrow("Tài khoản chưa được kích hoạt hoặc đã bị khóa.");
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });
});
