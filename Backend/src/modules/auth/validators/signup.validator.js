import { z } from 'zod';
import { createAddressSchema } from '../../users/validators/profile.validator.js';

export const signupSchema = z.object({
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(1, 'Name is required'),
  email: z
    .string({ error: 'A valid email address is required' })
    .trim()
    .email('A valid email address is required')
    .transform((email) => email.toLowerCase()),
  password: z
    .string({ error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters'),
  address: createAddressSchema.optional(),
});
