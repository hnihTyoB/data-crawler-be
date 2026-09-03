import { Router } from "express";
import { CrawlJobController } from "./crawl-job.controller";
import { apiKeyOrAuthMiddleware } from "../../middlewares/api-key.middleware";
import { validate, validateQuery } from "../../middlewares/validate.middleware";
import {
  createCrawlJobSchema,
  createExportSchema,
  listCrawlJobsQuerySchema,
} from "./crawl-job.validation";
import { crawlPageQuerySchema } from "../crawl-pages/crawl-page.validation";
import { requireRole } from "../../middlewares/role.middleware";
import { ROLES } from "../../common/constants/role.constant";

const router = Router();
const controller = new CrawlJobController();

router.post(
  "/",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER),
  validate(createCrawlJobSchema),
  (req, res, next) => {
    controller.create(req, res, next);
  },
);
router.get(
  "/",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER, ROLES.VIEWER),
  validateQuery(listCrawlJobsQuerySchema),
  controller.findAll,
);
router.get(
  "/:id",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER, ROLES.VIEWER),
  controller.findById,
);
router.delete(
  "/:id",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER),
  controller.delete,
);
router.post(
  "/:id/rerun",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER),
  controller.rerun,
);
router.get(
  "/:id/logs",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER, ROLES.VIEWER),
  controller.getLogs,
);
router.get(
  "/:id/events",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER, ROLES.VIEWER),
  controller.streamEvents,
);
router.post(
  "/:id/cancel",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER),
  controller.cancel,
);
router.get(
  "/:id/pages",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER, ROLES.VIEWER),
  validateQuery(crawlPageQuerySchema),
  controller.getPages,
);
router.get(
  "/:id/pages/preview",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER, ROLES.VIEWER),
  validateQuery(crawlPageQuerySchema),
  controller.getPagesPreview,
);
router.get(
  "/:id/exports",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER, ROLES.VIEWER),
  controller.getExports,
);
router.post(
  "/:id/exports",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER),
  validate(createExportSchema),
  (req, res, next) => {
    controller.createExport(req, res, next);
  },
);
router.get(
  "/:id/download",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER, ROLES.VIEWER),
  controller.download,
);
router.get(
  "/:id/assets",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER, ROLES.VIEWER),
  controller.getAssets,
);
router.get(
  "/:id/diff",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER, ROLES.VIEWER),
  controller.getDiff,
);
router.get(
  "/:id/diff/download",
  apiKeyOrAuthMiddleware,
  requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER, ROLES.VIEWER),
  controller.downloadDiff,
);
export default router;
