import { Router } from 'express';
import { z } from 'zod';
import {
  validateParams,
  validateQuery,
  validateRequest,
} from '../../../middlewares/validate-request.js';
import { adminAuth } from '../../auth/middlewares/admin-auth.js';
import {
  createProduct,
  addProductVariant,
  deleteProductVariant,
  deleteProduct,
  listAdminProducts,
  updateProductVariant,
  updateProduct,
} from '../controllers/product.controller.js';
import {
  productCreateSchema,
  productIdSchema,
  productVariantIdSchema,
  productVariantSchema,
  productVariantUpdateSchema,
  productUpdateSchema,
} from '../validators/product.validator.js';

const router = Router();
const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'active', 'inactive']).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

router.use(adminAuth);
router.get('/', validateQuery(listSchema), listAdminProducts);
router.post('/', validateRequest(productCreateSchema), createProduct);
router.post(
  '/:productId/variants',
  validateParams(productIdSchema),
  validateRequest(productVariantSchema),
  addProductVariant,
);
router.patch(
  '/:productId/variants/:variantId',
  validateParams(productVariantIdSchema),
  validateRequest(productVariantUpdateSchema),
  updateProductVariant,
);
router.delete(
  '/:productId/variants/:variantId',
  validateParams(productVariantIdSchema),
  deleteProductVariant,
);
router.patch(
  '/:productId',
  validateParams(productIdSchema),
  validateRequest(productUpdateSchema),
  updateProduct,
);
router.delete('/:productId', validateParams(productIdSchema), deleteProduct);

export default router;
