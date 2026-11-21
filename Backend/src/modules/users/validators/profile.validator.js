import { z } from 'zod';
import { mobileNumberSchema } from './mobile.validator.js';

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

const addressShape = {
  name: z.string().trim().min(1).max(100),
  mobile: mobileNumberSchema,
  pinCode: z.string().regex(/^\d{6}$/, 'PIN code must contain 6 digits'),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  addressLine: z.string().trim().min(1).max(500),
};

export const createAddressSchema = z.object(addressShape);

export const updateAddressSchema = z
  .object(addressShape)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one address field is required',
  });
