import { Router } from 'express';
import { WebhookController } from './webhook.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate, validateQuery } from '../../middlewares/validate.middleware';
import { createWebhookConfigSchema, updateWebhookConfigSchema, listWebhookDeliveriesQuerySchema } from './webhook.validation';

const router = Router();
const controller = new WebhookController();

router.post('/configs', authMiddleware, validate(createWebhookConfigSchema), controller.createConfig);
router.get('/configs', authMiddleware, controller.listConfigs);
router.patch('/configs/:id', authMiddleware, validate(updateWebhookConfigSchema), controller.updateConfig);
router.delete('/configs/:id', authMiddleware, controller.deleteConfig);
router.post('/configs/:id/test', authMiddleware, controller.testConfig);
router.get('/deliveries', authMiddleware, validateQuery(listWebhookDeliveriesQuerySchema), controller.listDeliveries);
router.post('/deliveries/:id/redeliver', authMiddleware, controller.redeliver);

export default router;
