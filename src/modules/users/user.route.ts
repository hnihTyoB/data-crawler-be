import { Router } from 'express';
import { UserController } from './user.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate, validateQuery } from '../../middlewares/validate.middleware';
import { createUserSchema, updateUserSchema, listUsersQuerySchema } from './user.validation';
import { ROLES } from '../../common/constants/role.constant';

const router = Router();
const controller = new UserController();

router.get('/', authMiddleware, requireRole(ROLES.ADMIN), validateQuery(listUsersQuerySchema), controller.findAll);
router.get('/:id', authMiddleware, requireRole(ROLES.ADMIN), controller.findById);
router.post('/', authMiddleware, requireRole(ROLES.ADMIN), validate(createUserSchema), (req, res, next) => {
  // #swagger.requestBody = { schema: { $ref: '#/components/schemas/CreateUserRequest' } }
  controller.create(req, res, next);
});
router.put('/:id', authMiddleware, requireRole(ROLES.ADMIN), validate(updateUserSchema), (req, res, next) => {
  // #swagger.requestBody = { schema: { $ref: '#/components/schemas/UpdateUserRequest' } }
  controller.update(req, res, next);
});
router.delete("/:id", authMiddleware, requireRole(ROLES.ADMIN), controller.delete);

export default router;
