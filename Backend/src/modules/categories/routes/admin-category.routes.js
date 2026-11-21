import { Router } from 'express';
import { z } from 'zod';
import {
  validateParams,
  validateQuery,
  validateRequest,
} from '../../../middlewares/validate-request.js';
import { adminAuth } from '../../auth/middlewares/admin-auth.js';
import {
  createCategory,
  deleteCategory,
  listAdminCategories,
  updateCategory,
} from '../controllers/category.controller.js';
import {
  categoryCreateSchema,
  categoryIdSchema,
  categoryListSchema,
  categoryUpdateSchema,
} from '../validators/category.validator.js';

const router = Router();
const adminListSchema = categoryListSchema.extend({
  status: z.enum(['active', 'inactive']).optional(),
});

router.use(adminAuth);
router.get('/', validateQuery(adminListSchema), listAdminCategories);
router.post('/', validateRequest(categoryCreateSchema), createCategory);
router.patch(
  '/:categoryId',
  validateParams(categoryIdSchema),
  validateRequest(categoryUpdateSchema),
  updateCategory,
);
router.delete('/:categoryId', validateParams(categoryIdSchema), deleteCategory);

export default router;
