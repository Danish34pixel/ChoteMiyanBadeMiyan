import { z } from 'zod';
import { mobileNumberSchema } from '../../users/validators/mobile.validator.js';

export const otpRequestSchema = z.object({
  mobile: mobileNumberSchema,
  purpose: z.enum(['signup', 'login']),
});

export const otpVerificationSchema = z.object({
  mobile: mobileNumberSchema,
  purpose: z.enum(['signup', 'login']),
  otp: z.string().regex(/^\d{6}$/, 'A valid verification code is required'),
});

export const mobileSignupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(8),
  mobile: mobileNumberSchema,
  verificationToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/, 'A valid verification token is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).max(128),
});
