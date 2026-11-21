import { z } from 'zod';

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
const imageSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      value === '' ||
      (z.url().safeParse(value).success &&
        ['http:', 'https:'].includes(new URL(value).protocol)),
  );

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  description: z.string().trim().max(2000).optional().default(''),
  image: imageSchema.optional().default(''),
  parentId: objectIdSchema.nullable().optional().default(null),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const categoryUpdateSchema = categoryCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one category field is required',
  });

export const categoryIdSchema = z.object({ categoryId: objectIdSchema });
export const categorySlugSchema = z.object({ slug: slugSchema });

export const categoryListSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'inactive']).optional(),
  parentId: objectIdSchema.nullable().optional(),
});
