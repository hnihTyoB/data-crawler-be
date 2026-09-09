import { Request, Response, NextFunction } from "express";
import {
  PERMISSIONS,
  PermissionSlug,
  SYSTEM_ROLE_DEFAULT_PERMISSIONS,
} from "../common/constants/permission.constant";
import {
  SYSTEM_ROLE_SLUGS,
  SystemRoleSlug,
} from "../common/constants/system-role.constant";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";
import { permissionService } from "../modules/permissions/permission.service";

async function resolveUserPermissions(req: Request): Promise<string[]> {
  let permissions = req.user.permissions;
  if (!permissions || !Array.isArray(permissions)) {
    permissions = await permissionService.getUserPermissions(req.user.id);
  }

  if (!req.user.roles) {
    req.user.roles = await permissionService.getUserRoles(req.user.id);
  }

  // Super Admin has all system permissions
  const isSuperAdmin =
    req.user.roles?.includes(SYSTEM_ROLE_SLUGS.SUPER_ADMIN) ||
    String(req.user.role).toLowerCase() === "super_admin";

  if (isSuperAdmin) {
    const allPerms = Object.values(PERMISSIONS) as string[];
    req.user.permissions = allPerms;
    return allPerms;
  }

  // Admin automatically inherits all default admin permissions merged with any assigned permissions
  const isAdmin =
    req.user.role === "ADMIN" ||
    String(req.user.role).toLowerCase() === "admin" ||
    req.user.roles?.includes(SYSTEM_ROLE_SLUGS.ADMIN);

  if (isAdmin) {
    const adminDefaults =
      SYSTEM_ROLE_DEFAULT_PERMISSIONS[SYSTEM_ROLE_SLUGS.ADMIN] || [];
    const merged = Array.from(new Set([...permissions, ...adminDefaults]));
    req.user.permissions = merged;
    return merged;
  }

  if (permissions.length === 0 && req.user.role) {
    const normalizedRole = String(req.user.role).toLowerCase() as SystemRoleSlug;
    const defaultPerms =
      SYSTEM_ROLE_DEFAULT_PERMISSIONS[normalizedRole] ||
      SYSTEM_ROLE_DEFAULT_PERMISSIONS[req.user.role as SystemRoleSlug] ||
      [];
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
