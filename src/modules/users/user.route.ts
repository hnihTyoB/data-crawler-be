import { Router } from "express";
import { UserController } from "./user.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { validate, validateQuery } from "../../middlewares/validate.middleware";
import {
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
  assignUserRolesSchema,
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
  controller.delete,
);

// User Roles Management
router.get(
  "/:id/roles",
  authMiddleware,
  requirePermission(PERMISSIONS.USERS_ROLES_READ),
  controller.getUserRoles,
);

router.put(
  "/:id/roles",
  authMiddleware,
  requirePermission(PERMISSIONS.USERS_ROLES_ASSIGN),
  validate(assignUserRolesSchema),
  controller.assignRoles,
);

router.post(
  "/:id/roles/:roleId",
  authMiddleware,
  requirePermission(PERMISSIONS.USERS_ROLES_ASSIGN),
  controller.assignRole,
);

router.delete(
  "/:id/roles/:roleId",
  authMiddleware,
  requirePermission(PERMISSIONS.USERS_ROLES_ASSIGN),
  controller.revokeRole,
);

export default router;
