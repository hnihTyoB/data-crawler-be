import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { authMiddleware } from "../auth.middleware";
import { jwtConfig } from "../../config/jwt.config";
import {
  revokeToken,
  revokeUserTokens,
  clearLocalTokenBlocklist,
} from "../../common/helpers/token-blocklist.helper";

const mockFindById = jest.fn();
jest.mock("../../modules/users/user.repository", () => {
  return {
    UserRepository: jest.fn().mockImplementation(() => ({
      findById: (...args: any[]) => mockFindById(...args),
    })),
  };
});

jest.mock("../../modules/permissions/permission.service", () => ({
  PermissionService: jest.fn().mockImplementation(() => ({
    getUserRoles: jest.fn().mockResolvedValue(["crawler_user"]),
    getUserPermissions: jest.fn().mockResolvedValue(["crawl_jobs:read"]),
  })),
}));

describe("authMiddleware - SEC-04 Token Revocation", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  const activeUser = {
    id: "user-123",
    email: "test@example.com",
    role: "CRAWLER_USER",
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearLocalTokenBlocklist();
    mockFindById.mockResolvedValue(activeUser);
    mockRes = {};
    mockNext = jest.fn();
  });

  it("allows access with a valid active access token", async () => {
    const token = jwt.sign(
      { id: activeUser.id, email: activeUser.email, role: activeUser.role },
      jwtConfig.accessSecret,
      { expiresIn: "15m" },
    );

    mockReq = {
      headers: { authorization: `Bearer ${token}` },
    };

    await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
    expect((mockReq as any).user).toMatchObject({
      id: activeUser.id,
      email: activeUser.email,
    });
  });

  it("rejects an access token that was individually revoked (post-logout)", async () => {
    const token = jwt.sign(
      { id: activeUser.id, email: activeUser.email, role: activeUser.role },
      jwtConfig.accessSecret,
      { expiresIn: "15m" },
    );

    // Explicitly revoke token (e.g. on logout)
    await revokeToken(token);

    mockReq = {
      headers: { authorization: `Bearer ${token}` },
    };

    await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Token has been revoked",
        statusCode: 401,
        code: "TOKEN_INVALID",
      }),
    );
  });

  it("rejects an access token issued before a password change / reset timestamp", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    // Simulate token issued 10 seconds ago
    const token = jwt.sign(
      {
        id: activeUser.id,
        email: activeUser.email,
        role: activeUser.role,
        iat: nowSeconds - 10,
      },
      jwtConfig.accessSecret,
      { expiresIn: "15m" },
    );

    // User changed password at nowSeconds
    await revokeUserTokens(activeUser.id, 86400, nowSeconds);

    mockReq = {
      headers: { authorization: `Bearer ${token}` },
    };

    await authMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Token has been revoked",
        statusCode: 401,
        code: "TOKEN_INVALID",
      }),
    );
  });
});
