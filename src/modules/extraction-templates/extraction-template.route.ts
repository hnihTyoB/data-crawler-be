import { Router } from 'express';
import { ExtractionTemplateController } from './extraction-template.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createExtractionTemplateSchema,
  updateExtractionTemplateSchema,
} from './extraction-template.validation';

const router = Router();
const controller = new ExtractionTemplateController();

router.use(authMiddleware);

router.post('/', validate(createExtractionTemplateSchema), controller.create);
router.get('/', controller.findAll);
router.get('/:id', controller.findById);
router.patch('/:id', validate(updateExtractionTemplateSchema), controller.update);
router.delete('/:id', controller.delete);

export default router;