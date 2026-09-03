import { Router } from "express";
import { PermissionController } from "./permission.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller = new PermissionController();

router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.PERMISSIONS_READ),
  controller.findAll,
);

router.get(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.PERMISSIONS_READ),
  controller.findById,
);

export default router;
