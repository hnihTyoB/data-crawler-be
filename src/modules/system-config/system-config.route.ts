import { Router } from "express";
import { SystemConfigController } from "./system-config.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import {
  validate,
  validateQuery,
  validateParams,
} from "../../middlewares/validate.middleware";
import {
  createSystemConfigSchema,
  updateSystemConfigSchema,
  systemConfigKeyParamSchema,
  systemConfigQuerySchema,
} from "./system-config.validation";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller = new SystemConfigController();

// 1. GET /api/v1/system/public (Public client access)
router.get("/public", controller.getPublic);

// 2. GET /api/v1/system/configs (Admin list configs with search and category filter)
router.get(
  "/configs",
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_READ),
  validateQuery(systemConfigQuerySchema),
  controller.findAll,
);

// 3. GET /api/v1/system/configs/:key (Get single config detail)
router.get(
  "/configs/:key",
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_READ),
  validateParams(systemConfigKeyParamSchema),
  controller.findByKey,
);

// 4. POST /api/v1/system/configs (Create new config)
router.post(
  "/configs",
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_MANAGE),
  validate(createSystemConfigSchema),
  controller.create,
);

// 5. PUT /api/v1/system/configs/:key (Update config)
router.put(
  "/configs/:key",
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_MANAGE),
  validateParams(systemConfigKeyParamSchema),
  validate(updateSystemConfigSchema),
  controller.update,
);

// 6. PATCH /api/v1/system/features/:key/toggle (Quick toggle for boolean Feature Flag)
router.patch(
  "/features/:key/toggle",
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_MANAGE),
  validateParams(systemConfigKeyParamSchema),
  controller.toggleFeature,
);

// 7. DELETE /api/v1/system/configs/:key (Delete config)
router.delete(
  "/configs/:key",
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_MANAGE),
  validateParams(systemConfigKeyParamSchema),
  controller.delete,
);

// 8. POST /api/v1/system/configs/sync-env (Sync configs from .env into DB)
router.post(
  "/configs/sync-env",
  authMiddleware,
  requirePermission(PERMISSIONS.SYSTEM_CONFIG_MANAGE),
  controller.syncFromEnv,
);

export default router;
