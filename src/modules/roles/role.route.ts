import { Router } from "express";
import { RoleController } from "./role.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate, validateQuery } from "../../middlewares/validate.middleware";
import {
  createRoleSchema,
  updateRoleSchema,
  assignRolePermissionsSchema,
  listRolesQuerySchema,
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
  validate(updateRoleSchema),
  controller.update,
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.ROLES_DELETE),
  controller.delete,
);

router.get(
  "/:id/permissions",
  authMiddleware,
  requirePermission(PERMISSIONS.ROLES_PERMISSIONS_READ),
  controller.getRolePermissions,
);

router.put(
  "/:id/permissions",
  authMiddleware,
  requirePermission(PERMISSIONS.ROLES_PERMISSIONS_ASSIGN),
  validate(assignRolePermissionsSchema),
  controller.setRolePermissions,
);

router.get(
  "/:id/users",
  authMiddleware,
  requirePermission(PERMISSIONS.ROLES_READ),
  controller.getRoleUsers,
);

export default router;
