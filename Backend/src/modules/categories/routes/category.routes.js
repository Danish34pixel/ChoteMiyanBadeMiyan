import { Router } from 'express';
import {
  validateParams,
  validateQuery,
} from '../../../middlewares/validate-request.js';
import {
  getCategory,
  listCategories,
} from '../controllers/category.controller.js';
import {
  categoryListSchema,
  categorySlugSchema,
} from '../validators/category.validator.js';

const router = Router();

router.get('/', validateQuery(categoryListSchema), listCategories);
router.get('/:slug', validateParams(categorySlugSchema), getCategory);

export default router;
