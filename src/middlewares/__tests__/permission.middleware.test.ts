import { Request, Response, NextFunction } from "express";
import {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
} from "../permission.middleware";
import { PermissionService } from "../../modules/permissions/permission.service";
import { PERMISSIONS } from "../../common/constants/permission.constant";

jest.mock("../../modules/permissions/permission.service");

describe("Permission Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      user: {
        id: "user-1",
        email: "user@example.com",
        role: "CRAWLER_USER",
        permissions: [PERMISSIONS.USERS_READ, PERMISSIONS.CRAWL_JOBS_CREATE],
      } as any,
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  describe("requirePermission", () => {
    it("should call next() when user has the required permission", async () => {
      const middleware = requirePermission(PERMISSIONS.USERS_READ);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should return 403 when user lacks the required permission", async () => {
      const middleware = requirePermission(PERMISSIONS.USERS_DELETE);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: "FORBIDDEN",
        }),
      );
    });

    it("should return 401 when request has no user", async () => {
      delete mockReq.user;
      const middleware = requirePermission(PERMISSIONS.USERS_READ);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          code: "UNAUTHORIZED",
        }),
      );
    });
  });

  describe("requireAnyPermission", () => {
    it("should call next() if user has at least one permission", async () => {
      const middleware = requireAnyPermission(
        PERMISSIONS.USERS_DELETE,
        PERMISSIONS.USERS_READ, // user has this
      );
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should return 403 if user lacks all permissions", async () => {
      const middleware = requireAnyPermission(
        PERMISSIONS.USERS_DELETE,
        PERMISSIONS.ROLES_CREATE,
      );
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: "FORBIDDEN",
        }),
      );
    });
  });

  describe("requireAllPermissions", () => {
    it("should call next() if user has all required permissions", async () => {
      const middleware = requireAllPermissions(
        PERMISSIONS.USERS_READ,
        PERMISSIONS.CRAWL_JOBS_CREATE,
      );
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should return 403 if user is missing at least one permission", async () => {
      const middleware = requireAllPermissions(
        PERMISSIONS.USERS_READ,
        PERMISSIONS.USERS_DELETE, // user lacks this
      );
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: "FORBIDDEN",
        }),
      );
    });
  });

  describe("Role-based permission inheritance and Super Admin bypass", () => {
    it("should grant full access to SUPER_ADMIN even if permission array is empty", async () => {
      mockReq.user = {
        id: "super-1",
        email: "super@example.com",
        role: "SUPER_ADMIN",
        roles: ["super_admin"],
        permissions: [],
      } as any;

      const middleware = requirePermission(PERMISSIONS.CRON_JOB_READ);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should grant CRON_JOB_READ to ADMIN role even if permissions array was missing it", async () => {
      mockReq.user = {
        id: "admin-1",
        email: "admin@example.com",
        role: "ADMIN",
        roles: ["admin"],
        permissions: [PERMISSIONS.USERS_READ], // Missing CRON_JOB_READ in DB array
      } as any;

      const middleware = requirePermission(PERMISSIONS.CRON_JOB_READ);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
