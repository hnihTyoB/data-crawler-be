import { Router } from "express";
import { ApiKeyController } from "./api-key.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  validate,
  validateParams,
} from "../../middlewares/validate.middleware";
import {
  createApiKeySchema,
  updateApiKeyStatusSchema,
  apiKeyParamsSchema,
} from "./api-key.validation";

const router = Router();
const controller = new ApiKeyController();

router.post(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.API_KEYS_CREATE),
  validate(createApiKeySchema),
  controller.create,
);
router.get(
  "/",
  authMiddleware,
  requirePermission(PERMISSIONS.API_KEYS_READ),
  controller.list,
);
router.patch(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.API_KEYS_UPDATE),
  validateParams(apiKeyParamsSchema),
  validate(updateApiKeyStatusSchema),
  controller.setActive,
);
router.delete(
  "/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.API_KEYS_DELETE),
  validateParams(apiKeyParamsSchema),
  controller.revoke,
);

export default router;
