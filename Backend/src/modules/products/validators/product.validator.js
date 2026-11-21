import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const imageSchema = z.object({
  url: z
    .string()
    .trim()
    .url()
    .max(2048)
    .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol)),
  alt: z.string().trim().max(200).optional().default(''),
});
const priceSchema = z
  .number()
  .finite()
  .min(0)
  .max(100000000)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, {
    message: 'Price can have at most two decimal places',
  });
const stockSchema = z.number().int().min(0).max(100000000);
const skuSchema = z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9._-]+$/);
const attributesSchema = z
  .record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(100))
  .refine((attributes) => Object.keys(attributes).length > 0);
const booleanQuerySchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const productVariantSchema = z
  .object({
    sku: skuSchema,
    attributes: attributesSchema,
    originalPrice: priceSchema,
    sellingPrice: priceSchema,
    stock: stockSchema,
    lowStockThreshold: stockSchema.optional().default(5),
    images: z.array(imageSchema).max(10).optional().default([]),
  })
  .refine((variant) => variant.sellingPrice <= variant.originalPrice, {
    path: ['sellingPrice'],
    message: 'Selling price cannot exceed original price',
  });

export const productCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    slug: slugSchema,
    description: z.string().trim().min(1).max(20000),
    sku: skuSchema.optional(),
    categoryId: objectIdSchema,
    subcategoryId: objectIdSchema.nullable().optional().default(null),
    images: z.array(imageSchema).max(10).optional().default([]),
    originalPrice: priceSchema,
    sellingPrice: priceSchema,
    stock: stockSchema.optional().default(0),
    lowStockThreshold: stockSchema.optional().default(5),
    variants: z.array(productVariantSchema).max(100).optional().default([]),
    status: z.enum(['draft', 'active', 'inactive']).optional().default('active'),
    featured: z.boolean().optional().default(false),
    bestseller: z.boolean().optional().default(false),
  })
  .refine((product) => product.sellingPrice <= product.originalPrice, {
    path: ['sellingPrice'],
    message: 'Selling price cannot exceed original price',
  })
  .refine((product) => product.variants.length > 0 || Boolean(product.sku), {
    path: ['sku'],
    message: 'SKU is required when the product has no variants',
  })
  .refine((product) => !product.variants.length || product.stock === 0, {
    path: ['stock'],
    message: 'Variant products use variant-level stock',
  });

export const productUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    slug: slugSchema,
    description: z.string().trim().min(1).max(20000),
    sku: skuSchema.nullable(),
    categoryId: objectIdSchema,
    subcategoryId: objectIdSchema.nullable(),
    images: z.array(imageSchema).max(10),
    originalPrice: priceSchema,
    sellingPrice: priceSchema,
    status: z.enum(['draft', 'active', 'inactive']),
    featured: z.boolean(),
    bestseller: z.boolean(),
  })
  .partial()
  .refine((product) => Object.keys(product).length > 0, {
    message: 'At least one product field is required',
  })
  .refine(
    (product) =>
      product.originalPrice === undefined ||
      product.sellingPrice === undefined ||
      product.sellingPrice <= product.originalPrice,
    {
      path: ['sellingPrice'],
      message: 'Selling price cannot exceed original price',
    },
  );

export const productIdSchema = z.object({ productId: objectIdSchema });
export const productVariantIdSchema = z.object({
  productId: objectIdSchema,
  variantId: objectIdSchema,
});
export const productVariantUpdateSchema = z
  .object({
    sku: skuSchema,
    attributes: attributesSchema,
    originalPrice: priceSchema,
    sellingPrice: priceSchema,
    lowStockThreshold: stockSchema,
    images: z.array(imageSchema).max(10),
  })
  .partial()
  .refine((variant) => Object.keys(variant).length > 0, {
    message: 'At least one variant field is required',
  })
  .refine(
    (variant) =>
      variant.originalPrice === undefined ||
      variant.sellingPrice === undefined ||
      variant.sellingPrice <= variant.originalPrice,
    {
      path: ['sellingPrice'],
      message: 'Selling price cannot exceed original price',
    },
  );
export const productSlugSchema = z.object({ slug: slugSchema });

export const productListSchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    category: slugSchema.optional(),
    minPrice: z.coerce.number().finite().min(0).optional(),
    maxPrice: z.coerce.number().finite().min(0).optional(),
    featured: booleanQuerySchema.optional(),
    bestseller: booleanQuerySchema.optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(
    (filters) =>
      filters.minPrice === undefined ||
      filters.maxPrice === undefined ||
      filters.minPrice <= filters.maxPrice,
    { path: ['maxPrice'], message: 'maxPrice must be at least minPrice' },
  );
