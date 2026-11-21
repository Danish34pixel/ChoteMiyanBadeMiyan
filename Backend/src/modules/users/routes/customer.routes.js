import { Router } from 'express';
import { z } from 'zod';
import {
  validateParams,
  validateRequest,
} from '../../../middlewares/validate-request.js';
import { customerAuth } from '../../auth/middlewares/customer-auth.js';
import {
  addAddress,
  deleteAddress,
  getProfile,
  listAddresses,
  updateAddress,
  updateProfile,
} from '../controllers/profile.controller.js';
import {
  createAddressSchema,
  updateAddressSchema,
  profileUpdateSchema,
} from '../validators/profile.validator.js';

const router = Router();
const addressIdSchema = z.object({
  addressId: z.string().regex(/^[a-f\d]{24}$/i, 'Address ID is invalid'),
});

router.use(customerAuth);
router.get('/me', getProfile);
router.patch('/me', validateRequest(profileUpdateSchema), updateProfile);
router.get('/me/addresses', listAddresses);
router.post(
  '/me/addresses',
  validateRequest(createAddressSchema),
  addAddress,
);
router.patch(
  '/me/addresses/:addressId',
  validateParams(addressIdSchema),
  validateRequest(updateAddressSchema),
  updateAddress,
);
router.delete(
  '/me/addresses/:addressId',
  validateParams(addressIdSchema),
  deleteAddress,
);

export default router;
