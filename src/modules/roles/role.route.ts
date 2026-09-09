import { Router } from "express";
import { RoleController } from "./role.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import {
  validate,
  validateQuery,
  validateParams,
} from "../../middlewares/validate.middleware";
import {
  createRoleSchema,
  updateRoleSchema,
  resetRoleQuotaSchema,
  assignRolePermissionsSchema,
  listRolesQuerySchema,
  roleParamsSchema,
} from "./role.validation";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller = new RoleController();

router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.ROLES_READ),
  validateQuery(listRolesQuerySchema),
  controller.findAll,
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.ROLES_READ),
  validateParams(roleParamsSchema),
  controller.findById,
);

router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.ROLES_CREATE),
  validate(createRoleSchema),
  controller.create,
);

router.patch(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.ROLES_UPDATE),
  validateParams(roleParamsSchema),
  validate(updateRoleSchema),
  controller.update,
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.ROLES_DELETE),
  validateParams(roleParamsSchema),
  controller.delete,
);

router.post(
  "/:id/reset-quota",
  authMiddleware,
  requirePermission(PERMISSIONS.ROLES_UPDATE),
  validateParams(roleParamsSchema),
  validate(resetRoleQuotaSchema),
  controller.resetRoleQuota,
);

router.get(
  "/:id/permissions",
  authMiddleware,
  requirePermission(PERMISSIONS.ROLES_PERMISSIONS_READ),
  validateParams(roleParamsSchema),
  controller.getRolePermissions,
);

router.put(
  "/:id/permissions",
  authMiddleware,
  requirePermission(PERMISSIONS.ROLES_PERMISSIONS_ASSIGN),
  validateParams(roleParamsSchema),
  validate(assignRolePermissionsSchema),
  controller.setRolePermissions,
);

router.get(
  "/:id/users",
  authMiddleware,
  requirePermission(PERMISSIONS.ROLES_READ),
  validateParams(roleParamsSchema),
  controller.getRoleUsers,
);

export default router;
