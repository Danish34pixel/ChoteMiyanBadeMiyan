import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i);

export const inventoryAdjustmentSchema = z.object({
  productId: objectIdSchema,
  variantId: objectIdSchema.optional(),
  delta: z
    .number()
    .int()
    .min(-100000000)
    .max(100000000)
    .refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(500),
});

export const inventoryHistoryQuerySchema = z.object({
  productId: objectIdSchema,
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
