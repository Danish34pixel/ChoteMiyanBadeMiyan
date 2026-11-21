import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ error: 'A valid email address is required' })
    .trim()
    .email('A valid email address is required')
    .transform((email) => email.toLowerCase()),
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password is required'),
});
