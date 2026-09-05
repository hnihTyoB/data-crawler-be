import { Router } from "express";
import { ExtractionTemplateController } from "./extraction-template.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  validate,
  validateParams,
} from "../../middlewares/validate.middleware";
import {
  createExtractionTemplateSchema,
  updateExtractionTemplateSchema,
  extractionTemplateParamsSchema,
} from "./extraction-template.validation";

const router = Router();
const controller = new ExtractionTemplateController();

router.use(authMiddleware);

router.post(
  "/",
  requirePermission(PERMISSIONS.EXTRACTION_TEMPLATES_CREATE),
  validate(createExtractionTemplateSchema),
  controller.create,
);
router.get(
  "/",
  requirePermission(PERMISSIONS.EXTRACTION_TEMPLATES_READ),
  controller.findAll,
);
router.get(
  "/:id",
  requirePermission(PERMISSIONS.EXTRACTION_TEMPLATES_READ),
  validateParams(extractionTemplateParamsSchema),
  controller.findById,
);
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.EXTRACTION_TEMPLATES_UPDATE),
  validateParams(extractionTemplateParamsSchema),
  validate(updateExtractionTemplateSchema),
  controller.update,
);
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.EXTRACTION_TEMPLATES_DELETE),
  validateParams(extractionTemplateParamsSchema),
  controller.delete,
);

export default router;
