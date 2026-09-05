import { Router } from "express";
import { CrawlScheduleController } from "./crawl-schedule.controller";
import { apiKeyOrAuthMiddleware } from "../../middlewares/api-key.middleware";
import {
  validate,
  validateQuery,
  validateParams,
} from "../../middlewares/validate.middleware";
import {
  createCrawlScheduleSchema,
  updateCrawlScheduleSchema,
  crawlScheduleQuerySchema,
  crawlScheduleHistoryQuerySchema,
  crawlScheduleParamsSchema,
} from "./crawl-schedule.validation";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller = new CrawlScheduleController();

router.post(
  "/",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_SCHEDULES_CREATE),
  validate(createCrawlScheduleSchema),
  controller.create,
);

router.get(
  "/",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_SCHEDULES_READ),
  validateQuery(crawlScheduleQuerySchema),
  controller.findAll,
);

router.get(
  "/:id",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_SCHEDULES_READ),
  validateParams(crawlScheduleParamsSchema),
  controller.findById,
);

router.patch(
  "/:id",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_SCHEDULES_UPDATE),
  validateParams(crawlScheduleParamsSchema),
  validate(updateCrawlScheduleSchema),
  controller.update,
);

router.delete(
  "/:id",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_SCHEDULES_DELETE),
  validateParams(crawlScheduleParamsSchema),
  controller.delete,
);

router.post(
  "/:id/run",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_SCHEDULES_RUN),
  validateParams(crawlScheduleParamsSchema),
  controller.triggerRun,
);

router.get(
  "/:id/history",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_SCHEDULES_READ),
  validateParams(crawlScheduleParamsSchema),
  validateQuery(crawlScheduleHistoryQuerySchema),
  controller.getHistory,
);

export default router;
