import mongoose from 'mongoose';
import { AppError } from '../../../utils/app-error.js';

const SEARCH_REGEX_META = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(value) {
  return value.replace(SEARCH_REGEX_META, '\\$&');
}

function isDuplicateKey(error) {
  return error?.code === 11000;
}

function duplicateProductError(error) {
  const field = Object.keys(error.keyPattern ?? {})[0];
  if (field === 'slug') return new AppError('A product with this slug already exists', 409);
  return new AppError('A product or variant with this SKU already exists', 409);
}

function publicSort(sort) {
  if (sort === 'price_asc') return { minimumSellingPrice: 1, _id: 1 };
  if (sort === 'price_desc') return { minimumSellingPrice: -1, _id: 1 };
  return { createdAt: -1, _id: -1 };
}

export function createProductService({
  productModel,
  categoryModel,
  inventoryAdjustmentModel,
  startSession = () => mongoose.startSession(),
}) {
  async function validateCategoryLinks(categoryId, subcategoryId) {
    const category = await categoryModel.findById(categoryId);
    if (!category) throw new AppError('Category not found', 404);
    if (!subcategoryId) return;

    const subcategory = await categoryModel.findById(subcategoryId);
    if (!subcategory || String(subcategory.parentId) !== String(categoryId)) {
      throw new AppError('Subcategory must be a child of the selected category', 400);
    }
  }

  async function activeCategoryIds() {
    const categories = await categoryModel
      .find({ status: 'active' })
      .select('_id')
      .lean();
    return categories.map((category) => category._id);
  }

  async function addInitialStockHistory(product, adjustedBy, session) {
    const adjustments = [];
    if (product.variants.length) {
      for (const variant of product.variants) {
        if (variant.stock > 0) {
          adjustments.push({
            productId: product._id,
            variantId: variant._id,
            sku: variant.sku,
            delta: variant.stock,
            quantityBefore: 0,
            quantityAfter: variant.stock,
            reason: 'Initial stock during product creation',
            adjustedBy,
          });
        }
      }
    } else if (product.stock > 0) {
      adjustments.push({
        productId: product._id,
        sku: product.sku,
        delta: product.stock,
        quantityBefore: 0,
        quantityAfter: product.stock,
        reason: 'Initial stock during product creation',
        adjustedBy,
      });
    }
    if (adjustments.length) {
      await inventoryAdjustmentModel.create(adjustments, { session });
    }
  }

  return {
    async listPublic({
      q,
      category,
      minPrice,
      maxPrice,
      featured,
      bestseller,
      sort,
      page,
      limit,
    }) {
      const categoryIds = await activeCategoryIds();
      const filter = {
        status: 'active',
        categoryId: { $in: categoryIds },
        $or: [
          { subcategoryId: null },
          { subcategoryId: { $in: categoryIds } },
        ],
      };
      if (category) {
        const selected = await categoryModel.findOne({
          slug: category,
          status: 'active',
        }).lean();
        if (!selected) {
          return {
            products: [],
            pagination: { page, limit, total: 0, pages: 0 },
          };
        }
        filter.$and = [
          ...(filter.$and ?? []),
          {
            $or: [
              { categoryId: selected._id },
              { subcategoryId: selected._id },
            ],
          },
        ];
      }
      if (q) {
        const term = new RegExp(escapeRegex(q), 'i');
        filter.$and = [
          ...(filter.$and ?? []),
          { $or: [{ name: term }, { description: term }] },
        ];
      }
      if (featured !== undefined) filter.featured = featured;
      if (bestseller !== undefined) filter.bestseller = bestseller;
      if (minPrice !== undefined || maxPrice !== undefined) {
        filter.minimumSellingPrice = {};
        if (minPrice !== undefined) filter.minimumSellingPrice.$gte = minPrice;
        if (maxPrice !== undefined) filter.minimumSellingPrice.$lte = maxPrice;
      }

      const [products, total] = await Promise.all([
        productModel
          .find(filter)
          .select('-skuKeys +minimumSellingPrice')
          .sort(publicSort(sort))
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        productModel.countDocuments(filter),
      ]);
      return {
        products: products.map((product) => ({
          ...product,
          priceFrom: product.minimumSellingPrice,
          minimumSellingPrice: undefined,
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    },

    async getPublicBySlug(slug) {
      const product = await productModel.findOne({
        slug,
        status: 'active',
      }).select('-skuKeys +minimumSellingPrice').lean();
      if (!product) throw new AppError('Product not found', 404);
      const [category, subcategory] = await Promise.all([
        categoryModel.findOne({ _id: product.categoryId, status: 'active' }).lean(),
        product.subcategoryId
          ? categoryModel.findOne({
              _id: product.subcategoryId,
              status: 'active',
            }).lean()
          : null,
      ]);
      if (!category || (product.subcategoryId && !subcategory)) {
        throw new AppError('Product not found', 404);
      }
      return {
        ...product,
        priceFrom: product.minimumSellingPrice,
        minimumSellingPrice: undefined,
        category,
        subcategory,
      };
    },

    async listAdmin({ page = 1, limit = 20, status, q }) {
      const filter = status ? { status } : {};
      if (q) {
        const term = new RegExp(escapeRegex(q), 'i');
        filter.$or = [
          { name: term },
          { sku: term },
          { 'variants.sku': term },
        ];
      }
      const [products, total] = await Promise.all([
        productModel
          .find(filter)
          .select('-skuKeys')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        productModel.countDocuments(filter),
      ]);
      return {
        products,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    },

    async create(input, adjustedBy) {
      await validateCategoryLinks(input.categoryId, input.subcategoryId);
      const session = await startSession();
      let product;
      try {
        await session.withTransaction(async () => {
          product = new productModel(input);
          await product.save({ session });
          await addInitialStockHistory(product, adjustedBy, session);
        });
      } catch (error) {
        if (isDuplicateKey(error)) throw duplicateProductError(error);
        throw error;
      } finally {
        await session.endSession();
      }
      return product;
    },

    async update(productId, changes) {
      const product = await productModel.findById(productId);
      if (!product) throw new AppError('Product not found', 404);
      const categoryId = changes.categoryId ?? product.categoryId;
      const subcategoryId = Object.hasOwn(changes, 'subcategoryId')
        ? changes.subcategoryId
        : product.subcategoryId;
      await validateCategoryLinks(categoryId, subcategoryId);
      Object.assign(product, changes);
      try {
        return await product.save();
      } catch (error) {
        if (isDuplicateKey(error)) throw duplicateProductError(error);
        throw error;
      }
    },

    async addVariant(productId, input, adjustedBy) {
      const session = await startSession();
      let product;
      try {
        await session.withTransaction(async () => {
          product = await productModel.findById(productId).session(session);
          if (!product) throw new AppError('Product not found', 404);
          product.variants.push(input);
          await product.save({ session });
          const variant = product.variants.at(-1);
          if (variant.stock > 0) {
            await inventoryAdjustmentModel.create(
              [
                {
                  productId: product._id,
                  variantId: variant._id,
                  sku: variant.sku,
                  delta: variant.stock,
                  quantityBefore: 0,
                  quantityAfter: variant.stock,
                  reason: 'Initial stock during variant creation',
                  adjustedBy,
                },
              ],
              { session },
            );
          }
        });
      } catch (error) {
        if (isDuplicateKey(error)) throw duplicateProductError(error);
        throw error;
      } finally {
        await session.endSession();
      }
      return product.variants.at(-1);
    },

    async updateVariant(productId, variantId, changes) {
      const product = await productModel.findById(productId);
      if (!product) throw new AppError('Product not found', 404);
      const variant = product.variants.id(variantId);
      if (!variant) throw new AppError('Product variant not found', 404);
      Object.assign(variant, changes);
      try {
        await product.save();
      } catch (error) {
        if (isDuplicateKey(error)) throw duplicateProductError(error);
        throw error;
      }
      return variant;
    },

    async removeVariant(productId, variantId) {
      const product = await productModel.findById(productId);
      if (!product) throw new AppError('Product not found', 404);
      const variant = product.variants.id(variantId);
      if (!variant) throw new AppError('Product variant not found', 404);
      if (variant.stock > 0) {
        throw new AppError(
          'Variant cannot be removed while it has stock; adjust inventory first',
          409,
        );
      }
      if (product.variants.length === 1) {
        product.sku = variant.sku;
        product.originalPrice = variant.originalPrice;
        product.sellingPrice = variant.sellingPrice;
        product.lowStockThreshold = variant.lowStockThreshold;
        product.stock = 0;
      }
      product.variants.pull(variantId);
      try {
        await product.save();
      } catch (error) {
        if (isDuplicateKey(error)) throw duplicateProductError(error);
        throw error;
      }
      return { id: String(variantId), deleted: true };
    },

    async remove(productId) {
      const product = await productModel.findById(productId);
      if (!product) throw new AppError('Product not found', 404);
      product.status = 'inactive';
      await product.save();
      return { id: String(product._id), inactive: true };
    },
  };
}
