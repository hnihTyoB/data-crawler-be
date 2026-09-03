import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthService } from "../auth.service";
import { AuthController } from "../auth.controller";
import { jwtConfig } from "../../../config/jwt.config";
import { ROLES } from "../../../common/constants/role.constant";
import { ERROR_CODE } from "../../../common/errors/error-code";
import { AUDIT_ACTIONS } from "../../../common/constants/audit-action.constant";
import { Request, Response } from "express";

describe("AuthService - Account Self-Deactivation", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = "production";
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  const rawPassword = "UserPassword123!";
  const passwordHash = bcrypt.hashSync(rawPassword, 10);

  const activeUser = {
    id: "user-uuid-1",
    email: "user@example.com",
    passwordHash,
    fullName: "Nguyễn Văn Test",
    role: ROLES.CRAWLER_USER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminUser = {
    id: "admin-uuid-1",
    email: "admin@example.com",
    passwordHash,
    fullName: "System Admin",
    role: ROLES.ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("requestDeactivation", () => {
    it("throws 404 NOT_FOUND if user is not found or already inactive", async () => {
      const service = new AuthService();
      const repository = {
        findById: jest.fn().mockResolvedValue(null),
      };
      (service as unknown as { repository: typeof repository }).repository =
        repository;

      await expect(
        service.requestDeactivation("non-existent-id", {
          password: rawPassword,
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: ERROR_CODE.NOT_FOUND,
      });
    });

    it("throws 400 VALIDATION_ERROR if user is the sole active ADMIN", async () => {
      const service = new AuthService();
      const repository = {
        findById: jest.fn().mockResolvedValue(adminUser),
        countActiveAdmins: jest.fn().mockResolvedValue(1),
      };
      (service as unknown as { repository: typeof repository }).repository =
        repository;

      await expect(
        service.requestDeactivation(adminUser.id, { password: rawPassword }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: ERROR_CODE.VALIDATION_ERROR,
        message: expect.stringContaining("Quản trị viên duy nhất"),
      });
      expect(repository.countActiveAdmins).toHaveBeenCalledTimes(1);
    });

    it("throws 401 INVALID_CREDENTIALS if password does not match", async () => {
      const service = new AuthService();
      const repository = {
        findById: jest.fn().mockResolvedValue(activeUser),
        countActiveAdmins: jest.fn(),
      };
      (service as unknown as { repository: typeof repository }).repository =
        repository;

      await expect(
        service.requestDeactivation(activeUser.id, {
          password: "WrongPassword!",
        }),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: ERROR_CODE.INVALID_CREDENTIALS,
      });
    });

    it("successfully sends deactivation email and does NOT leak token in return", async () => {
      const service = new AuthService();
      const repository = {
        findById: jest.fn().mockResolvedValue(activeUser),
        countActiveAdmins: jest.fn(),
      };
      const mailService = {
        sendDeactivationEmail: jest.fn().mockResolvedValue(undefined),
      };
      const mutableService = service as unknown as {
        repository: typeof repository;
        mailService: typeof mailService;
      };
      mutableService.repository = repository;
      mutableService.mailService = mailService;

      const result = await service.requestDeactivation(activeUser.id, {
        password: rawPassword,
      });

      expect(result).toEqual({ success: true });
      expect(result).not.toHaveProperty("token");
      expect(result).not.toHaveProperty("deactivationToken");
      expect(mailService.sendDeactivationEmail).toHaveBeenCalledTimes(1);

      const [calledEmail, calledToken] =
        mailService.sendDeactivationEmail.mock.calls[0];
      expect(calledEmail).toBe(activeUser.email);

      // Verify the generated token has purpose: deactivate-account and is signed with user's passwordHash
      const decoded = jwt.verify(
        calledToken,
        `${jwtConfig.accessSecret}:deactivate:${activeUser.passwordHash}`,
      ) as { id: string; email: string; purpose: string };
      expect(decoded.id).toBe(activeUser.id);
      expect(decoded.email).toBe(activeUser.email);
      expect(decoded.purpose).toBe("deactivate-account");
    });

    it("allows ADMIN to request deactivation if multiple active admins exist", async () => {
      const service = new AuthService();
      const repository = {
        findById: jest.fn().mockResolvedValue(adminUser),
        countActiveAdmins: jest.fn().mockResolvedValue(2),
      };
      const mailService = {
        sendDeactivationEmail: jest.fn().mockResolvedValue(undefined),
      };
      const mutableService = service as unknown as {
        repository: typeof repository;
        mailService: typeof mailService;
      };
      mutableService.repository = repository;
      mutableService.mailService = mailService;

      const result = await service.requestDeactivation(adminUser.id, {
        password: rawPassword,
      });

      expect(result).toEqual({ success: true });
      expect(mailService.sendDeactivationEmail).toHaveBeenCalledTimes(1);
    });

    it("throws 503 MAIL_DELIVERY_FAILED if mailService throws an error", async () => {
      const service = new AuthService();
      const repository = {
        findById: jest.fn().mockResolvedValue(activeUser),
      };
      const mailService = {
        sendDeactivationEmail: jest
          .fn()
          .mockRejectedValue(new Error("SMTP down")),
      };
      const mutableService = service as unknown as {
        repository: typeof repository;
        mailService: typeof mailService;
      };
      mutableService.repository = repository;
      mutableService.mailService = mailService;

      await expect(
        service.requestDeactivation(activeUser.id, { password: rawPassword }),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: ERROR_CODE.MAIL_DELIVERY_FAILED,
      });
    });
  });

  describe("confirmDeactivation", () => {
    it("throws 400 TOKEN_INVALID if token is not valid JWT format", async () => {
      const service = new AuthService();
      await expect(
        service.confirmDeactivation({ token: "invalid-token-string" }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: ERROR_CODE.TOKEN_INVALID,
      });
    });

    it("throws 400 TOKEN_INVALID if token purpose is not deactivate-account", async () => {
      const wrongPurposeToken = jwt.sign(
        {
          id: activeUser.id,
          email: activeUser.email,
          purpose: "email-verification",
        },
        `${jwtConfig.accessSecret}:deactivate:${activeUser.passwordHash}`,
        { expiresIn: "15m" },
      );

      const service = new AuthService();
      await expect(
        service.confirmDeactivation({ token: wrongPurposeToken }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: ERROR_CODE.TOKEN_INVALID,
      });
    });

    it("throws 400 USER_INACTIVE if user is not found or already inactive", async () => {
      const validToken = jwt.sign(
        {
          id: "unknown-id",
          email: "none@example.com",
          purpose: "deactivate-account",
        },
        `${jwtConfig.accessSecret}:deactivate:anyhash`,
        { expiresIn: "15m" },
      );

      const service = new AuthService();
      const repository = {
        findById: jest.fn().mockResolvedValue(null),
      };
      (service as unknown as { repository: typeof repository }).repository =
        repository;

      await expect(
        service.confirmDeactivation({ token: validToken }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: ERROR_CODE.USER_INACTIVE,
      });
    });

    it("throws 400 TOKEN_EXPIRED if deactivation token has expired", async () => {
      const expiredToken = jwt.sign(
        {
          id: activeUser.id,
          email: activeUser.email,
          purpose: "deactivate-account",
        },
        `${jwtConfig.accessSecret}:deactivate:${activeUser.passwordHash}`,
        { expiresIn: "-1s" },
      );

      const service = new AuthService();
      const repository = {
        findById: jest.fn().mockResolvedValue(activeUser),
      };
      (service as unknown as { repository: typeof repository }).repository =
        repository;

      await expect(
        service.confirmDeactivation({ token: expiredToken }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: ERROR_CODE.TOKEN_EXPIRED,
      });
    });

    it("throws 400 TOKEN_INVALID if token signature was tampered or used wrong passwordHash", async () => {
      const tamperedToken = jwt.sign(
        {
          id: activeUser.id,
          email: activeUser.email,
          purpose: "deactivate-account",
        },
        `wrong-secret-key`,
        { expiresIn: "15m" },
      );

      const service = new AuthService();
      const repository = {
        findById: jest.fn().mockResolvedValue(activeUser),
      };
      (service as unknown as { repository: typeof repository }).repository =
        repository;

      await expect(
        service.confirmDeactivation({ token: tamperedToken }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: ERROR_CODE.TOKEN_INVALID,
      });
    });

    it("throws 400 VALIDATION_ERROR if user is the sole ADMIN at confirmation time", async () => {
      const adminToken = jwt.sign(
        {
          id: adminUser.id,
          email: adminUser.email,
          purpose: "deactivate-account",
        },
        `${jwtConfig.accessSecret}:deactivate:${adminUser.passwordHash}`,
        { expiresIn: "15m" },
      );

      const service = new AuthService();
      const repository = {
        findById: jest.fn().mockResolvedValue(adminUser),
        countActiveAdmins: jest.fn().mockResolvedValue(1),
        deactivateUser: jest.fn(),
      };
      (service as unknown as { repository: typeof repository }).repository =
        repository;

      await expect(
        service.confirmDeactivation({ token: adminToken }),
      ).rejects.toMatchObject({
        statusCode: 400,
        code: ERROR_CODE.VALIDATION_ERROR,
      });
      expect(repository.deactivateUser).not.toHaveBeenCalled();
    });

    it("successfully confirms deactivation and invokes repository.deactivateUser", async () => {
      const validToken = jwt.sign(
        {
          id: activeUser.id,
          email: activeUser.email,
          purpose: "deactivate-account",
        },
        `${jwtConfig.accessSecret}:deactivate:${activeUser.passwordHash}`,
        { expiresIn: "15m" },
      );

      const service = new AuthService();
      const repository = {
        findById: jest.fn().mockResolvedValue(activeUser),
        countActiveAdmins: jest.fn(),
        deactivateUser: jest.fn().mockResolvedValue(undefined),
      };
      (service as unknown as { repository: typeof repository }).repository =
        repository;

      const result = await service.confirmDeactivation({ token: validToken });

      expect(result).toEqual({
        success: true,
        userId: activeUser.id,
        email: activeUser.email,
      });
      expect(repository.deactivateUser).toHaveBeenCalledWith(activeUser.id);
      expect(repository.deactivateUser).toHaveBeenCalledTimes(1);
    });
  });
});

describe("AuthController - Account Self-Deactivation", () => {
  let controller: AuthController;
  let mockService: {
    requestDeactivation: jest.Mock;
    confirmDeactivation: jest.Mock;
  };
  let mockAuditLogService: {
    log: jest.Mock;
  };

  beforeEach(() => {
    controller = new AuthController();
    mockService = {
      requestDeactivation: jest.fn(),
      confirmDeactivation: jest.fn(),
    };
    mockAuditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    (controller as unknown as { service: typeof mockService }).service =
      mockService;
    (
      controller as unknown as {
        auditLogService: typeof mockAuditLogService;
      }
    ).auditLogService = mockAuditLogService;
  });

  it("handles requestDeactivation, logs audit event, and returns 200 response", async () => {
    mockService.requestDeactivation.mockResolvedValue({ success: true });

    const req = {
      user: { id: "user-123", email: "user@example.com" },
      body: { password: "Password123!" },
      ip: "127.0.0.1",
      headers: { "user-agent": "Jest-Test-Agent" },
    } as unknown as Request;

    const res = {
      json: jest.fn(),
    } as unknown as Response;

    const next = jest.fn();

    await controller.requestDeactivation(req, res, next);

    expect(mockService.requestDeactivation).toHaveBeenCalledWith("user-123", {
      password: "Password123!",
    });
    expect(mockAuditLogService.log).toHaveBeenCalledWith({
      userId: "user-123",
      action: AUDIT_ACTIONS.REQUEST_DEACTIVATE_ACCOUNT,
      ipAddress: "127.0.0.1",
      userAgent: "Jest-Test-Agent",
      details: { email: "user@example.com" },
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.any(String),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("handles confirmDeactivation, logs audit event, clears cookies, and returns 200 response", async () => {
    mockService.confirmDeactivation.mockResolvedValue({
      success: true,
      userId: "user-123",
      email: "user@example.com",
    });

    const req = {
      body: { token: "sample-valid-token" },
      ip: "127.0.0.1",
      headers: { "user-agent": "Jest-Test-Agent" },
    } as unknown as Request;

    const res = {
      clearCookie: jest.fn(),
      json: jest.fn(),
    } as unknown as Response;

    const next = jest.fn();

    await controller.confirmDeactivation(req, res, next);

    expect(mockService.confirmDeactivation).toHaveBeenCalledWith({
      token: "sample-valid-token",
    });
    expect(mockAuditLogService.log).toHaveBeenCalledWith({
      userId: "user-123",
      action: AUDIT_ACTIONS.CONFIRM_DEACTIVATE_ACCOUNT,
      ipAddress: "127.0.0.1",
      userAgent: "Jest-Test-Agent",
      details: { email: "user@example.com" },
    });
    expect(res.clearCookie).toHaveBeenCalledWith("accessToken");
    expect(res.clearCookie).toHaveBeenCalledWith("refreshToken");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.any(String),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("passes errors to next() middleware on failure", async () => {
    const testError = new Error("Something went wrong");
    mockService.requestDeactivation.mockRejectedValue(testError);

    const req = {
      user: { id: "user-123", email: "user@example.com" },
      body: { password: "Password123!" },
      ip: "127.0.0.1",
      headers: { "user-agent": "Jest-Test-Agent" },
    } as unknown as Request;

    const res = { json: jest.fn() } as unknown as Response;
    const next = jest.fn();

    await controller.requestDeactivation(req, res, next);

    expect(next).toHaveBeenCalledWith(testError);
  });
});
