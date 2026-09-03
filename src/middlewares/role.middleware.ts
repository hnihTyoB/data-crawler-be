import { Request, Response, NextFunction } from "express";
import { Role } from "../common/constants/role.constant";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";

export function requireRole(...roles: (Role | string)[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED));
      return;
    }

    const normalizedRequired = roles.map((r) => r.toLowerCase());
    const userLegacyRole = req.user.role ? req.user.role.toLowerCase() : "";
    const userDynamicRoles = (req.user.roles || []).map((r) => r.toLowerCase());

    const hasRole =
      normalizedRequired.includes(userLegacyRole) ||
      userDynamicRoles.some((r) => normalizedRequired.includes(r));

    if (!hasRole) {
      next(new AppError("Forbidden", 403, ERROR_CODE.FORBIDDEN));
      return;
    }

    next();
  };
}
