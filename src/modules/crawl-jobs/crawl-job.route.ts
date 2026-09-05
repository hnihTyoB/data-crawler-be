import { Router } from "express";
import { CrawlJobController } from "./crawl-job.controller";
import { apiKeyOrAuthMiddleware } from "../../middlewares/api-key.middleware";
import {
  validate,
  validateQuery,
  validateParams,
} from "../../middlewares/validate.middleware";
import {
  createCrawlJobSchema,
  createExportSchema,
  listCrawlJobsQuerySchema,
  getAssetsQuerySchema,
  jobLogsQuerySchema,
  diffQuerySchema,
  crawlJobParamsSchema,
} from "./crawl-job.validation";
import { crawlPageQuerySchema } from "../crawl-pages/crawl-page.validation";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";

const router = Router();
const controller = new CrawlJobController();

router.post(
  "/",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_JOBS_CREATE),
  validate(createCrawlJobSchema),
  (req, res, next) => {
    controller.create(req, res, next);
  },
);
router.get(
  "/",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_JOBS_READ),
  validateQuery(listCrawlJobsQuerySchema),
  controller.findAll,
);
router.get(
  "/:id",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_JOBS_READ),
  validateParams(crawlJobParamsSchema),
  controller.findById,
);
router.delete(
  "/:id",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_JOBS_DELETE),
  validateParams(crawlJobParamsSchema),
  controller.delete,
);
router.post(
  "/:id/rerun",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_JOBS_RETRY),
  validateParams(crawlJobParamsSchema),
  controller.rerun,
);
router.get(
  "/:id/logs",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_JOBS_READ),
  validateParams(crawlJobParamsSchema),
  validateQuery(jobLogsQuerySchema),
  controller.getLogs,
);
router.get(
  "/:id/events",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_JOBS_READ),
  validateParams(crawlJobParamsSchema),
  controller.streamEvents,
);
router.post(
  "/:id/cancel",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_JOBS_CANCEL),
  validateParams(crawlJobParamsSchema),
  controller.cancel,
);
router.get(
  "/:id/pages",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_JOBS_READ),
  validateParams(crawlJobParamsSchema),
  validateQuery(crawlPageQuerySchema),
  controller.getPages,
);
router.get(
  "/:id/pages/preview",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_JOBS_READ),
  validateParams(crawlJobParamsSchema),
  validateQuery(crawlPageQuerySchema),
  controller.getPagesPreview,
);
router.get(
  "/:id/exports",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.EXPORTS_READ),
  validateParams(crawlJobParamsSchema),
  controller.getExports,
);
router.post(
  "/:id/exports",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.EXPORTS_CREATE),
  validateParams(crawlJobParamsSchema),
  validate(createExportSchema),
  (req, res, next) => {
    controller.createExport(req, res, next);
  },
);
router.get(
  "/:id/download",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.EXPORTS_DOWNLOAD),
  validateParams(crawlJobParamsSchema),
  controller.download,
);
router.get(
  "/:id/assets",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_JOBS_READ),
  validateParams(crawlJobParamsSchema),
  validateQuery(getAssetsQuerySchema),
  controller.getAssets,
);
router.get(
  "/:id/diff",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_JOBS_READ),
  validateParams(crawlJobParamsSchema),
  validateQuery(diffQuerySchema),
  controller.getDiff,
);
router.get(
  "/:id/diff/download",
  apiKeyOrAuthMiddleware,
  requirePermission(PERMISSIONS.CRAWL_JOBS_READ),
  validateParams(crawlJobParamsSchema),
  validateQuery(diffQuerySchema),
  controller.downloadDiff,
);
export default router;
