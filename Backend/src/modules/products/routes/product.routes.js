import { Router } from 'express';
import {
  validateParams,
  validateQuery,
} from '../../../middlewares/validate-request.js';
import {
  getProduct,
  listProducts,
} from '../controllers/product.controller.js';
import {
  productListSchema,
  productSlugSchema,
} from '../validators/product.validator.js';

const router = Router();

router.get('/', validateQuery(productListSchema), listProducts);
router.get('/:slug', validateParams(productSlugSchema), getProduct);

export default router;
