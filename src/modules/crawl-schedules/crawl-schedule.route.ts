import { Router } from "express";
import { CrawlScheduleController } from "./crawl-schedule.controller";
import { apiKeyOrAuthMiddleware } from "../../middlewares/api-key.middleware";
import { validate, validateQuery } from "../../middlewares/validate.middleware";
import {
  createCrawlScheduleSchema,
  updateCrawlScheduleSchema,
  crawlScheduleQuerySchema,
  crawlScheduleHistoryQuerySchema,
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
  controller.findById,
);

router.patch(
  "/:id",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_SCHEDULES_UPDATE),
  validate(updateCrawlScheduleSchema),
  controller.update,
);

router.delete(
  "/:id",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_SCHEDULES_DELETE),
  controller.delete,
);

router.post(
  "/:id/run",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_SCHEDULES_RUN),
  controller.triggerRun,
);

router.get(
  "/:id/history",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_SCHEDULES_READ),
  validateQuery(crawlScheduleHistoryQuerySchema),
  controller.getHistory,
);

export default router;
