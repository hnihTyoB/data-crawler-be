import { Router } from "express";
import { UserController } from "./user.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import {
  validate,
  validateQuery,
  validateParams,
} from "../../middlewares/validate.middleware";
import {
  createUserSchema,
  updateUserSchema,
  resetUserQuotaSchema,
  listUsersQuerySchema,
  assignUserRolesSchema,
  userParamsSchema,
  userRoleAssignmentParamsSchema,
} from "./user.validation";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller = new UserController();

router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.USERS_READ),
  validateQuery(listUsersQuerySchema),
  controller.findAll,
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.USERS_READ),
  validateParams(userParamsSchema),
  controller.findById,
);

router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.USERS_CREATE),
  validate(createUserSchema),
  (req, res, next) => {
    // #swagger.requestBody = { schema: { $ref: '#/components/schemas/CreateUserRequest' } }
    controller.create(req, res, next);
  },
);

router.put(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validateParams(userParamsSchema),
  validate(updateUserSchema),
  (req, res, next) => {
    // #swagger.requestBody = { schema: { $ref: '#/components/schemas/UpdateUserRequest' } }
    controller.update(req, res, next);
  },
);

router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.USERS_DELETE),
  validateParams(userParamsSchema),
  controller.delete,
);

router.post(
  "/:id/reset-quota",
  authMiddleware,
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validateParams(userParamsSchema),
  validate(resetUserQuotaSchema),
  controller.resetQuota,
);

router.get(
  "/:id/roles",
  authMiddleware,
  requirePermission(PERMISSIONS.USERS_ROLES_READ),
  validateParams(userParamsSchema),
  controller.getUserRoles,
);

router.put(
  "/:id/roles",
  authMiddleware,
  requirePermission(PERMISSIONS.USERS_ROLES_ASSIGN),
  validateParams(userParamsSchema),
  validate(assignUserRolesSchema),
  controller.assignRoles,
);

router.post(
  "/:id/roles/:roleId",
  authMiddleware,
  requirePermission(PERMISSIONS.USERS_ROLES_ASSIGN),
  validateParams(userRoleAssignmentParamsSchema),
  controller.assignRole,
);

router.delete(
  "/:id/roles/:roleId",
  authMiddleware,
  requirePermission(PERMISSIONS.USERS_ROLES_ASSIGN),
  validateParams(userRoleAssignmentParamsSchema),
  controller.revokeRole,
);

export default router;
