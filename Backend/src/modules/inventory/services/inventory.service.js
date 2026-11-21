import mongoose from 'mongoose';
import { AppError } from '../../../utils/app-error.js';

export function createInventoryService({
  productModel,
  adjustmentModel,
  startSession = () => mongoose.startSession(),
}) {
  return {
    async adjust({ productId, variantId, delta, reason }, adjustedBy) {
      const session = await startSession();
      let adjustment;
      try {
        await session.withTransaction(async () => {
          const product = await productModel.findById(productId).session(session);
          if (!product) throw new AppError('Product not found', 404);

          let stockItem;
          if (variantId) {
            stockItem = product.variants.id(variantId);
            if (!stockItem) throw new AppError('Product variant not found', 404);
          } else {
            if (product.variants.length) {
              throw new AppError('A variant must be selected for this product', 400);
            }
            stockItem = product;
          }

          const quantityBefore = stockItem.stock;
          const quantityAfter = quantityBefore + delta;
          if (quantityAfter < 0) {
            throw new AppError('Inventory adjustment would make stock negative', 409);
          }
          stockItem.stock = quantityAfter;
          await product.save({ session });

          [adjustment] = await adjustmentModel.create(
            [
              {
                productId: product._id,
                variantId: variantId ?? null,
                sku: stockItem.sku,
                delta,
                quantityBefore,
                quantityAfter,
                reason,
                adjustedBy,
              },
            ],
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
      return adjustment;
    },

    async listHistory({ productId, page, limit }) {
      const filter = { productId };
      const [adjustments, total] = await Promise.all([
        adjustmentModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        adjustmentModel.countDocuments(filter),
      ]);
      return {
        adjustments,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    },
  };
}
