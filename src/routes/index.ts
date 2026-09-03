import { Router } from 'express';
import authRoute from '../modules/auth/auth.route';
import userRoute from '../modules/users/user.route';
import crawlJobRoute from '../modules/crawl-jobs/crawl-job.route';
import crawlExportRoute from '../modules/crawl-exports/crawl-export.route';
import auditLogRoute from '../modules/audit-logs/audit-log.route';
import apiKeyRoute from '../modules/api-keys/api-key.route';
import webhookRoute from '../modules/webhooks/webhook.route';
import extractionTemplateRoute from '../modules/extraction-templates/extraction-template.route';
import crawlScheduleRoute from '../modules/crawl-schedules/crawl-schedule.route';
import healthRoute from '../modules/health/health.route';
import dashboardRoute from '../modules/dashboard/dashboard.route';

const router = Router();

router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/users', userRoute);
router.use('/dashboard', dashboardRoute);
router.use('/crawl-jobs', crawlJobRoute);
router.use('/crawl-schedules', crawlScheduleRoute);
router.use('/exports', crawlExportRoute);
router.use('/audit-logs', auditLogRoute);
router.use('/api-keys', apiKeyRoute);
router.use('/webhooks', webhookRoute);
router.use('/extraction-templates', extractionTemplateRoute);
export default router;
