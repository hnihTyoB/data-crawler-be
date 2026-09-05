import { Request, Response, NextFunction } from "express";
import {
  PermissionSlug,
  SYSTEM_ROLE_DEFAULT_PERMISSIONS,
} from "../common/constants/permission.constant";
import { SystemRoleSlug } from "../common/constants/system-role.constant";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";
import { PermissionService } from "../modules/permissions/permission.service";

const permissionService = new PermissionService();

async function resolveUserPermissions(req: Request): Promise<string[]> {
  if (req.user.permissions && Array.isArray(req.user.permissions)) {
    return req.user.permissions;
  }

  const permissions = await permissionService.getUserPermissions(req.user.id);

  if (!req.user.roles) {
    req.user.roles = await permissionService.getUserRoles(req.user.id);
  }

  if (permissions.length === 0 && req.user.role) {
    const defaultPerms =
      SYSTEM_ROLE_DEFAULT_PERMISSIONS[req.user.role as SystemRoleSlug] || [];
    req.user.permissions = defaultPerms;
    return defaultPerms;
  }

  req.user.permissions = permissions;
  return permissions;
}

export function requirePermission(permission: PermissionSlug) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        next(new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED));
        return;
      }

      const userPermissions = await resolveUserPermissions(req);

      if (!userPermissions.includes(permission)) {
        next(
          new AppError(
            `Forbidden: Missing required permission [${permission}]`,
            403,
            ERROR_CODE.FORBIDDEN,
          ),
        );
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAnyPermission(...permissions: PermissionSlug[]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        next(new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED));
        return;
      }

      if (permissions.length === 0) {
        next(
          new AppError(
            "Forbidden: No permissions specified",
            403,
            ERROR_CODE.FORBIDDEN,
          ),
        );
        return;
      }

      const userPermissions = await resolveUserPermissions(req);
      const hasAny = permissions.some((perm) => userPermissions.includes(perm));

      if (!hasAny) {
        next(
          new AppError(
            `Forbidden: Requires at least one of [${permissions.join(", ")}]`,
            403,
            ERROR_CODE.FORBIDDEN,
          ),
        );
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAllPermissions(...permissions: PermissionSlug[]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        next(new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED));
        return;
      }

      const userPermissions = await resolveUserPermissions(req);
      const hasAll = permissions.every((perm) =>
        userPermissions.includes(perm),
      );

      if (!hasAll) {
        next(
          new AppError(
            `Forbidden: Requires all permissions [${permissions.join(", ")}]`,
            403,
            ERROR_CODE.FORBIDDEN,
          ),
        );
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
