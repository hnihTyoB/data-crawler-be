import { Router } from "express";
import { WebhookController } from "./webhook.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { PERMISSIONS } from "../../common/constants/permission.constant";
import {
  validate,
  validateQuery,
  validateParams,
} from "../../middlewares/validate.middleware";
import {
  createWebhookConfigSchema,
  updateWebhookConfigSchema,
  listWebhookDeliveriesQuerySchema,
  webhookParamsSchema,
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
  validateParams(webhookParamsSchema),
  validate(updateWebhookConfigSchema),
  controller.updateConfig,
);
router.delete(
  "/configs/:id",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOKS_DELETE),
  validateParams(webhookParamsSchema),
  controller.deleteConfig,
);
router.post(
  "/configs/:id/test",
  authMiddleware,
  requirePermission(PERMISSIONS.WEBHOOKS_TEST),
  validateParams(webhookParamsSchema),
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
  validateParams(webhookParamsSchema),
  controller.redeliver,
);

export default router;
