import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    alt: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { _id: false },
);

function validPrice(value) {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true, uppercase: true },
    attributes: {
      type: Map,
      of: String,
      required: true,
    },
    originalPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: validPrice,
        message: 'Price can have at most two decimal places',
      },
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: [
        {
          validator: validPrice,
          message: 'Price can have at most two decimal places',
        },
        {
          validator(value) {
            return this.originalPrice === undefined || value <= this.originalPrice;
          },
          message: 'Selling price cannot exceed original price',
        },
      ],
    },
    stock: { type: Number, required: true, min: 0, validate: Number.isInteger },
    lowStockThreshold: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
      default: 5,
    },
    images: { type: [imageSchema], default: [] },
  },
  { timestamps: true },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    description: { type: String, required: true, trim: true, maxlength: 20000 },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      required() {
        return !this.variants?.length;
      },
    },
    skuKeys: { type: [String], select: false, default: [] },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    images: { type: [imageSchema], default: [] },
    originalPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: validPrice,
        message: 'Price can have at most two decimal places',
      },
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: [
        {
          validator: validPrice,
          message: 'Price can have at most two decimal places',
        },
        {
          validator(value) {
            return this.originalPrice === undefined || value <= this.originalPrice;
          },
          message: 'Selling price cannot exceed original price',
        },
      ],
    },
    minimumSellingPrice: {
      type: Number,
      min: 0,
      select: false,
    },
    stock: {
      type: Number,
      min: 0,
      validate: [
        Number.isInteger,
        {
          validator(value) {
            return !this.variants?.length || value === 0;
          },
          message: 'Variant products use variant-level stock',
        },
      ],
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 5,
    },
    variants: {
      type: [variantSchema],
      default: [],
      validate: {
        validator(variants) {
          const skus = [
            ...(this.sku ? [this.sku] : []),
            ...variants.map((variant) => variant.sku),
          ].map((sku) => sku.trim().toUpperCase());
          return new Set(skus).size === skus.length;
        },
        message: 'Product and variant SKUs must be unique',
      },
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'inactive'],
      default: 'active',
      index: true,
    },
    featured: { type: Boolean, default: false },
    bestseller: { type: Boolean, default: false },
  },
  { timestamps: true },
);

productSchema.pre('validate', function validateInventory(next) {
  const skus = [
    ...(this.sku ? [this.sku] : []),
    ...this.variants.map((variant) => variant.sku),
  ];
  const normalized = skus.map((sku) => sku.trim().toUpperCase());

  if (!this.variants.length && !this.sku) {
    this.invalidate('sku', 'SKU is required when the product has no variants');
  }

  if (new Set(normalized).size !== normalized.length) {
    this.invalidate('variants', 'Product and variant SKUs must be unique');
  }

  if (this.variants.length && this.stock !== 0) {
    this.invalidate('stock', 'Variant products use variant-level stock');
  }

  if (this.sellingPrice > this.originalPrice) {
    this.invalidate('sellingPrice', 'Selling price cannot exceed original price');
  }

  this.minimumSellingPrice = this.variants.length
    ? Math.min(...this.variants.map((variant) => variant.sellingPrice))
    : this.sellingPrice;

  for (const [index, variant] of this.variants.entries()) {
    if (variant.sellingPrice > variant.originalPrice) {
      this.invalidate(
        `variants.${index}.sellingPrice`,
        'Selling price cannot exceed original price',
      );
    }
  }

  this.skuKeys = normalized;
  next();
});

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ skuKeys: 1 }, { unique: true, sparse: true });
productSchema.index({ status: 1, categoryId: 1, createdAt: -1 });
productSchema.index({ status: 1, sellingPrice: 1 });
productSchema.index({ status: 1, minimumSellingPrice: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.set('toJSON', {
  transform(_document, returnedObject) {
    delete returnedObject.skuKeys;
    delete returnedObject.minimumSellingPrice;
    delete returnedObject.__v;
    return returnedObject;
  },
});

const Product =
  mongoose.models.Product ?? mongoose.model('Product', productSchema);

export default Product;
