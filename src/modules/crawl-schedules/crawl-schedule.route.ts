import { Router } from "express";
import { CrawlScheduleController } from "./crawl-schedule.controller";
import { apiKeyOrAuthMiddleware } from "../../middlewares/api-key.middleware";
import { validate, validateQuery } from "../../middlewares/validate.middleware";
import {
  createCrawlScheduleSchema,
  updateCrawlScheduleSchema,
  crawlScheduleQuerySchema,
} from "./crawl-schedule.validation";
import { requireRole } from "../../middlewares/role.middleware";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller = new CrawlScheduleController();

router.post(
  "/",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER),
  validate(createCrawlScheduleSchema),
  controller.create,
);

router.get(
  "/",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER, ROLES.VIEWER),
  validateQuery(crawlScheduleQuerySchema),
  controller.findAll,
);

router.get(
  "/:id",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER, ROLES.VIEWER),
  controller.findById,
);

router.patch(
  "/:id",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER),
  validate(updateCrawlScheduleSchema),
  controller.update,
);

router.delete(
  "/:id",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER),
  controller.delete,
);

router.post(
  "/:id/run",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER),
  controller.triggerRun,
);

router.get(
  "/:id/history",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER, ROLES.VIEWER),
  controller.getHistory,
);

export default router;
