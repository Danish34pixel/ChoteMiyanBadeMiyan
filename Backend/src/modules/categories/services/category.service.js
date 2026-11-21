import { AppError } from '../../../utils/app-error.js';

function isDuplicateKey(error) {
  return error?.code === 11000;
}

function duplicateSlugError() {
  return new AppError('A category with this slug already exists', 409);
}

export function createCategoryService({ categoryModel, productModel }) {
  async function validateParent(parentId, categoryId) {
    if (!parentId) return;

    let parent = await categoryModel.findById(parentId);
    if (!parent) {
      throw new AppError('Parent category not found', 404);
    }

    const visited = new Set([String(categoryId ?? '')]);
    while (parent) {
      const currentId = String(parent._id ?? parent.id);
      if (visited.has(currentId)) {
        throw new AppError('Category hierarchy cannot contain a cycle', 400);
      }
      visited.add(currentId);
      parent = parent.parentId
        ? await categoryModel.findById(parent.parentId)
        : null;
    }
  }

  return {
    async list({ page = 1, limit = 20, status, parentId } = {}, publicOnly = false) {
      const filter = publicOnly ? { status: 'active' } : {};
      if (!publicOnly && status) filter.status = status;
      if (parentId !== undefined) filter.parentId = parentId;
      const [categories, total] = await Promise.all([
        categoryModel
          .find(filter)
          .sort({ name: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        categoryModel.countDocuments(filter),
      ]);

      return {
        categories,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    },

    async getPublicBySlug(slug) {
      const category = await categoryModel.findOne({
        slug,
        status: 'active',
      }).lean();
      if (!category) throw new AppError('Category not found', 404);
      return category;
    },

    async create(input) {
      await validateParent(input.parentId);
      try {
        return await categoryModel.create(input);
      } catch (error) {
        if (isDuplicateKey(error)) throw duplicateSlugError();
        throw error;
      }
    },

    async update(categoryId, changes) {
      const category = await categoryModel.findById(categoryId);
      if (!category) throw new AppError('Category not found', 404);
      if (Object.hasOwn(changes, 'parentId')) {
        if (String(changes.parentId ?? '') !== String(category.parentId ?? '')) {
          const hasProductsUsingAsSubcategory = await productModel.exists({
            subcategoryId: categoryId,
          });
          if (hasProductsUsingAsSubcategory) {
            throw new AppError(
              'Category parent cannot change while products use it as a subcategory',
              409,
            );
          }
        }
        await validateParent(changes.parentId, categoryId);
      }
      Object.assign(category, changes);
      try {
        return await category.save();
      } catch (error) {
        if (isDuplicateKey(error)) throw duplicateSlugError();
        throw error;
      }
    },

    async remove(categoryId) {
      const category = await categoryModel.findById(categoryId);
      if (!category) throw new AppError('Category not found', 404);
      const [hasChildren, hasProducts] = await Promise.all([
        categoryModel.exists({ parentId: categoryId }),
        productModel.exists({
          $or: [
            { categoryId },
            { subcategoryId: categoryId },
          ],
        }),
      ]);
      if (hasChildren || hasProducts) {
        throw new AppError(
          'Category cannot be deleted while products or child categories depend on it',
          409,
        );
      }
      await category.deleteOne();
      return { id: String(category._id), deleted: true };
    },
  };
}
