import { Router } from "express";
import { DashboardController } from "./dashboard.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller = new DashboardController();

router.get(
  "/stats",
  authMiddleware,
  requirePermission(PERMISSIONS.DASHBOARD_READ),
  controller.getStats,
);

export default router;
