import { Router } from "express";
import { cronController } from "./cron.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../middlewares/validate.middleware";
import {
  cronJobParamsSchema,
  listCronJobsQuerySchema,
  toggleCronJobBodySchema,
  triggerCronJobBodySchema,
} from "./cron.validation";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();

/**
 * 1. GET /api/v1/cron/jobs
 * Danh sách toàn bộ các tác vụ định kỳ và lịch biểu
 */
router.get(
  "/jobs",
  authMiddleware,
  requirePermission(PERMISSIONS.CRON_JOB_READ),
  validateQuery(listCronJobsQuerySchema),
  cronController.listJobs,
);

/**
 * 2. POST /api/v1/cron/jobs/:jobName/trigger
 * Kích hoạt chạy ngay một tác vụ thủ công
 */
router.post(
  "/jobs/:jobName/trigger",
  authMiddleware,
  requirePermission(PERMISSIONS.CRON_JOB_MANAGE),
  validateParams(cronJobParamsSchema),
  validate(triggerCronJobBodySchema),
  cronController.triggerJob,
);

/**
 * 3. PATCH /api/v1/cron/jobs/:jobName/toggle
 * Bật hoặc tắt kích hoạt tự động theo lịch của một tác vụ
 */
router.patch(
  "/jobs/:jobName/toggle",
  authMiddleware,
  requirePermission(PERMISSIONS.CRON_JOB_MANAGE),
  validateParams(cronJobParamsSchema),
  validate(toggleCronJobBodySchema),
  cronController.toggleJob,
);

export default router;
