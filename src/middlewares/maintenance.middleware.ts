import { Request, Response, NextFunction } from "express";

/**
 * Middleware chế độ bảo trì: Hệ thống không áp dụng chế độ bảo trì.
 * Middleware này đóng vai trò no-op pass-through.
 */
export async function maintenanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  next();
}

