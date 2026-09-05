import { Router } from "express";
import { WebhookController } from "./webhook.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import { validate, validateQuery } from "../../middlewares/validate.middleware";
import {
  createWebhookConfigSchema,
  updateWebhookConfigSchema,
  listWebhookDeliveriesQuerySchema,
} from "./webhook.validation";

const router = Router();
const controller = new WebhookController();

router.post(
  "/configs",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOKS_CREATE),
  validate(createWebhookConfigSchema),
  controller.createConfig,
);
router.get(
  "/configs",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOKS_READ),
  controller.listConfigs,
);
router.patch(
  "/configs/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOKS_UPDATE),
  validate(updateWebhookConfigSchema),
  controller.updateConfig,
);
router.delete(
  "/configs/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOKS_DELETE),
  controller.deleteConfig,
);
router.post(
  "/configs/:id/test",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOKS_TEST),
  controller.testConfig,
);
router.get(
  "/deliveries",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOKS_READ),
  validateQuery(listWebhookDeliveriesQuerySchema),
  controller.listDeliveries,
);
router.post(
  "/deliveries/:id/redeliver",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOKS_UPDATE),
  controller.redeliver,
);

export default router;
