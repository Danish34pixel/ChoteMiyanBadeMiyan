import { Router } from 'express';
import {
  validateQuery,
  validateRequest,
} from '../../../middlewares/validate-request.js';
import { adminAuth } from '../../auth/middlewares/admin-auth.js';
import {
  adjustInventory,
  listInventoryHistory,
} from '../controllers/inventory.controller.js';
import {
  inventoryAdjustmentSchema,
  inventoryHistoryQuerySchema,
} from '../validators/inventory.validator.js';

const router = Router();

router.use(adminAuth);
router.get(
  '/adjustments',
  validateQuery(inventoryHistoryQuerySchema),
  listInventoryHistory,
);
router.post(
  '/adjustments',
  validateRequest(inventoryAdjustmentSchema),
  adjustInventory,
);

export default router;
