import { Router } from 'express';
import { CrawlExportController } from './crawl-export.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLES } from '../../common/constants/role.constant';

const router = Router();
const controller = new CrawlExportController();

router.get('/:exportId/download', authMiddleware, requireRole(ROLES.ADMIN, ROLES.CRAWLER_USER, ROLES.VIEWER), controller.download);

export default router;

