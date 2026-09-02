import { Router } from 'express';
import { WebhookController } from './webhook.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate, validateQuery } from '../../middlewares/validate.middleware';
import { createWebhookConfigSchema, listWebhookDeliveriesQuerySchema } from './webhook.validation';

const router = Router();
const controller = new WebhookController();

router.post('/configs', authMiddleware, validate(createWebhookConfigSchema), controller.createConfig);
router.get('/configs', authMiddleware, controller.listConfigs);
router.delete('/configs/:id', authMiddleware, controller.deleteConfig);
router.get('/deliveries', authMiddleware, validateQuery(listWebhookDeliveriesQuerySchema), controller.listDeliveries);
router.post('/deliveries/:id/redeliver', authMiddleware, controller.redeliver);

export default router;
