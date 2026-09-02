import { Router } from 'express';
import { HealthController } from './health.controller';

const router = Router();
const controller = new HealthController();

router.get('/liveness', controller.getLiveness);
router.get('/readiness', controller.getReadiness);
router.get('/metrics', controller.getMetrics);

export default router;
