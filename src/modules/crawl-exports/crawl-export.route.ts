import { Router } from "express";
import { CrawlExportController } from "./crawl-export.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  validateQuery,
  validateParams,
} from "../../middlewares/validate.middleware";
import {
  crawlExportQuerySchema,
  crawlExportParamsSchema,
} from "./crawl-export.validation";

const router = Router();
const controller = new CrawlExportController();

router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.EXPORTS_READ),
  validateQuery(crawlExportQuerySchema),
  controller.findAll,
);
router.get(
  "/:exportId/download",
  authMiddleware,
  requirePermission(PERMISSIONS.EXPORTS_DOWNLOAD),
  validateParams(crawlExportParamsSchema),
  controller.download,
);
router.delete(
  "/:exportId",
  authMiddleware,
  requirePermission(PERMISSIONS.EXPORTS_DELETE),
  validateParams(crawlExportParamsSchema),
  controller.delete,
);

export default router;
