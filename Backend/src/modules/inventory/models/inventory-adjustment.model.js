import mongoose from 'mongoose';

const inventoryAdjustmentSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    sku: { type: String, required: true, trim: true, uppercase: true },
    delta: { type: Number, required: true, validate: Number.isInteger },
    quantityBefore: { type: Number, required: true, min: 0 },
    quantityAfter: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    adjustedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

inventoryAdjustmentSchema.index({ productId: 1, createdAt: -1 });
inventoryAdjustmentSchema.index({ variantId: 1, createdAt: -1 });

const InventoryAdjustment =
  mongoose.models.InventoryAdjustment ??
  mongoose.model('InventoryAdjustment', inventoryAdjustmentSchema);

export default InventoryAdjustment;
