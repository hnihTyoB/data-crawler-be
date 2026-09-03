import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { jwtConfig } from "../config/jwt.config";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";
import { UserRepository } from "../modules/users/user.repository";
import { PermissionService } from "../modules/permissions/permission.service";

const userRepository = new UserRepository();
const permissionService = new PermissionService();

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  let token: string | undefined = req.cookies?.accessToken;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }

  if (!token) {
    next(new AppError("Unauthorized", 401, ERROR_CODE.UNAUTHORIZED));
    return;
  }

  try {
    const payload = jwt.verify(token, jwtConfig.accessSecret) as {
      id: string;
      email: string;
      role: string;
    };

    const user = await userRepository.findById(payload.id);

    if (!user) {
      next(new AppError("User not found", 401, ERROR_CODE.UNAUTHORIZED));
      return;
    }

    if (!user.isActive) {
      next(new AppError("Account is inactive", 403, ERROR_CODE.USER_INACTIVE));
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
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError("Token expired", 401, ERROR_CODE.TOKEN_EXPIRED));
    } else {
      next(new AppError("Invalid token", 401, ERROR_CODE.TOKEN_INVALID));
    }
  }
}

export function copyRefreshTokenToBody(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.cookies?.refreshToken && !req.body.refreshToken) {
    req.body.refreshToken = req.cookies.refreshToken;
  }
  next();
}
