import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    image: { type: String, trim: true, maxlength: 2048, default: '' },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true },
);

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentId: 1, status: 1, name: 1 });

const Category =
  mongoose.models.Category ?? mongoose.model('Category', categorySchema);

export default Category;
