import { Router } from 'express';
import { AuditLogController } from './audit-log.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validateQuery } from '../../middlewares/validate.middleware';
import { listAuditLogsQuerySchema } from './audit-log.validation';
import { requireRole } from '../../middlewares/role.middleware';
import { ROLES } from '../../common/constants/role.constant';

const router = Router();
const controller = new AuditLogController();

router.get('/', authMiddleware, requireRole(ROLES.ADMIN), validateQuery(listAuditLogsQuerySchema), controller.findAll);

export default router;
