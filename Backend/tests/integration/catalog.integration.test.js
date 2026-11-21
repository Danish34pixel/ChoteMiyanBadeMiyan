import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import Category from '../../src/modules/categories/models/category.model.js';
import { createCategoryService } from '../../src/modules/categories/services/category.service.js';
import Product from '../../src/modules/products/models/product.model.js';
import { createProductService } from '../../src/modules/products/services/product.service.js';
import InventoryAdjustment from '../../src/modules/inventory/models/inventory-adjustment.model.js';
import { createInventoryService } from '../../src/modules/inventory/services/inventory.service.js';
import { getMongoIntegrationSkipReason } from '../helpers/mongodb.js';

const mongoTestUri = process.env.MONGODB_TEST_URI;
const integrationSkipReason = getMongoIntegrationSkipReason();

test(
  'catalog CRUD, active product search, and transactional inventory history',
  { skip: integrationSkipReason },
  async (t) => {
    try {
      await mongoose.connect(mongoTestUri, { serverSelectionTimeoutMS: 5000 });
    } catch (error) {
      if (error.name !== 'MongooseServerSelectionError') throw error;
      await mongoose.disconnect();
      t.skip('Dedicated MongoDB test database is unavailable');
      return;
    }

    try {
      await Promise.all([
        Category.init(),
        Product.init(),
        InventoryAdjustment.init(),
      ]);
    } catch (error) {
      await mongoose.disconnect();
      throw error;
    }

    const suffix = randomUUID();
    const actorId = new mongoose.Types.ObjectId();
    let parent;
    let child;
    let product;
    const categoryService = createCategoryService({
      categoryModel: Category,
      productModel: Product,
    });
    const productService = createProductService({
      productModel: Product,
      categoryModel: Category,
      inventoryAdjustmentModel: InventoryAdjustment,
    });
    const inventoryService = createInventoryService({
      productModel: Product,
      adjustmentModel: InventoryAdjustment,
    });

    try {
      parent = await categoryService.create({
        name: `Integration ${suffix}`,
        slug: `integration-${suffix}`,
        status: 'active',
      });
      child = await categoryService.create({
        name: `Child ${suffix}`,
        slug: `child-${suffix}`,
        parentId: parent._id,
        status: 'active',
      });
      product = await productService.create(
        {
          name: `Product ${suffix}`,
          slug: `product-${suffix}`,
          description: 'Catalog integration test',
          sku: `SKU-${suffix.slice(0, 8)}`,
          categoryId: parent._id,
          subcategoryId: child._id,
          originalPrice: 100,
          sellingPrice: 80,
          stock: 5,
          status: 'active',
        },
        actorId,
      );
      assert.equal(product.stock, 5);
      assert.equal(
        (await categoryService.list({ page: 1, limit: 10 }, true)).categories
          .some((category) => String(category._id) === String(parent._id)),
        true,
      );

      const listing = await productService.listPublic({
        q: `Product ${suffix}`,
        category: child.slug,
        minPrice: 70,
        maxPrice: 90,
        sort: 'newest',
        page: 1,
        limit: 10,
      });
      assert.equal(listing.pagination.total, 1);
      assert.equal(String(listing.products[0]._id), String(product._id));

      const adjustment = await inventoryService.adjust(
        {
          productId: String(product._id),
          delta: -2,
          reason: 'Integration test correction',
        },
        actorId,
      );
      assert.equal(adjustment.quantityBefore, 5);
      assert.equal(adjustment.quantityAfter, 3);
      assert.equal(
        (await inventoryService.listHistory({
          productId: String(product._id),
          page: 1,
          limit: 10,
        })).pagination.total,
        2,
      );

      await assert.rejects(
        categoryService.remove(String(parent._id)),
        (error) => error.statusCode === 409,
      );
      const updated = await productService.update(String(product._id), {
        status: 'inactive',
      });
      assert.equal(updated.status, 'inactive');
    } finally {
      try {
        if (product) {
          await Promise.all([
            InventoryAdjustment.deleteMany({ productId: product._id }),
            Product.deleteOne({ _id: product._id }),
          ]);
        }
        if (child) await Category.deleteOne({ _id: child._id });
        if (parent) await Category.deleteOne({ _id: parent._id });
      } finally {
        await mongoose.disconnect();
      }
    }
  },
);
