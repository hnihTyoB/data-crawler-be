import { Router } from 'express';
import { WebhookController } from './webhook.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createWebhookConfigSchema } from './webhook.validation';

const router = Router();
const controller = new WebhookController();

router.post('/configs', authMiddleware, validate(createWebhookConfigSchema), controller.createConfig);
router.get('/configs', authMiddleware, controller.listConfigs);
router.delete('/configs/:id', authMiddleware, controller.deleteConfig);
router.get('/deliveries', authMiddleware, controller.listDeliveries);

export default router;
