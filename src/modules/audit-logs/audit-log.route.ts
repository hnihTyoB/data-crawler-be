import { Router } from "express";
import { AuditLogController } from "./audit-log.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validateQuery } from "../../middlewares/validate.middleware";
import { listAuditLogsQuerySchema } from "./audit-log.validation";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller = new AuditLogController();

router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.AUDIT_LOGS_READ),
  validateQuery(listAuditLogsQuerySchema),
  controller.findAll,
);

export default router;
