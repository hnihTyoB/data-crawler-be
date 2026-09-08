import { Request, Response, NextFunction } from "express";
import { systemConfigService } from "../modules/system-config/system-config.service";
import { ERROR_CODE } from "../common/errors/error-code";

/**
 * Middleware kiểm tra chế độ bảo trì toàn hệ thống (feature.maintenance_mode.enabled)
 * Khi bảo trì được bật, chặn các request từ người dùng thông thường,
 * ngoại trừ các endpoint quản trị cấu hình, đăng nhập và health check.
 */
export async function maintenanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Bỏ qua các endpoint thiết yếu để Admin vẫn có thể đăng nhập và tắt chế độ bảo trì
  const publicPaths = [
    "/system",
    "/auth/login",
    "/auth/refresh",
    "/api-docs",
    "/health",
  ];

  const isPublicOrAdminExempt = publicPaths.some(
    (prefix) => req.path === prefix || req.path.startsWith(prefix + "/"),
  );

  if (isPublicOrAdminExempt) {
    return next();
  }

  const isMaintenanceMode = await systemConfigService.isFeatureEnabled(
    "feature.maintenance_mode.enabled",
    false,
  );

  if (isMaintenanceMode) {
    // Nếu là Admin thì cho phép qua
    const user = (req as any).user;
    if (user?.role === "ADMIN") {
      return next();
    }

    return res.status(503).json({
      success: false,
      message:
        "Hệ thống đang trong chế độ bảo trì định kỳ để nâng cấp. Vui lòng quay lại sau ít phút.",
      code: ERROR_CODE.INTERNAL_SERVER_ERROR,
    });
  }

  next();
}
