import { Request, Response, NextFunction } from "express";
import { ApiKeyService } from "../modules/api-keys/api-key.service";
import { PermissionService } from "../modules/permissions/permission.service";
import { authMiddleware } from "./auth.middleware";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";

const apiKeyService = new ApiKeyService();
const permissionService = new PermissionService();

export async function apiKeyOrAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const apiKey = req.headers["x-api-key"] as string | undefined;

  if (apiKey) {
    try {
      const validKeyRecord = await apiKeyService.validate(apiKey);
      const user = validKeyRecord.user;

      if (!user) {
        next(
          new AppError(
            "User associated with API key not found",
            401,
            ERROR_CODE.UNAUTHORIZED,
          ),
        );
        return;
      }

      if (!user.isActive) {
        next(
          new AppError("Account is inactive", 403, ERROR_CODE.USER_INACTIVE),
        );
        return;
      }

      const [roles, permissions] = await Promise.all([
        permissionService.getUserRoles(user.id),
        permissionService.getUserPermissions(user.id),
      ]);

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        roles,
        permissions,
      };

      next();
    } catch (error) {
      next(error);
    }
  } else {
    authMiddleware(req, res, next);
  }
}
