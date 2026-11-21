import assert from 'node:assert/strict';
import test from 'node:test';
import Category from '../../src/modules/categories/models/category.model.js';
import Product from '../../src/modules/products/models/product.model.js';
import InventoryAdjustment from '../../src/modules/inventory/models/inventory-adjustment.model.js';

const categoryId = 'aaaaaaaaaaaaaaaaaaaaaaaa';

test('category model validates unique-slug format and hierarchy fields', () => {
  const category = new Category({
    name: 'Home & Kitchen',
    slug: 'home-kitchen',
    parentId: categoryId,
    status: 'active',
  });
  assert.equal(category.validateSync(), undefined);
  assert.equal(Category.schema.indexes().some(([index, options]) =>
    index.slug === 1 && options.unique === true), true);
});

test('product model supports simple stock and variant-specific prices and inventory', () => {
  const simple = new Product({
    name: 'Bottle',
    slug: 'bottle',
    description: 'Steel bottle',
    sku: 'BTL-1',
    categoryId,
    originalPrice: 500,
    sellingPrice: 400,
    stock: 3,
  });
  assert.equal(simple.validateSync(), undefined);

  const variants = new Product({
    name: 'T-shirt',
    slug: 't-shirt',
    description: 'Cotton t-shirt',
    categoryId,
    originalPrice: 1000,
    sellingPrice: 800,
    variants: [
      {
        sku: 'TS-S',
        attributes: { size: 'S', color: 'Black' },
        originalPrice: 1000,
        sellingPrice: 800,
        stock: 4,
      },
    ],
  });
  assert.equal(variants.validateSync(), undefined);
  assert.equal(variants.variants[0].stock, 4);
});

test('product validation builds unique SKU keys and the lowest variant display price', async () => {
  const product = new Product({
    name: 'T-shirt',
    slug: 'shirt',
    description: 'Cotton t-shirt',
    categoryId,
    originalPrice: 100,
    sellingPrice: 90,
    variants: [
      {
        sku: 'TS-S',
        attributes: { size: 'S' },
        originalPrice: 100,
        sellingPrice: 90,
        stock: 1,
      },
      {
        sku: 'TS-M',
        attributes: { size: 'M' },
        originalPrice: 100,
        sellingPrice: 75.15,
        stock: 2,
      },
    ],
  });

  await product.validate();
  assert.equal(product.minimumSellingPrice, 75.15);
  assert.deepEqual(product.skuKeys, ['TS-S', 'TS-M']);
  assert.equal('skuKeys' in product.toJSON(), false);
  assert.equal('minimumSellingPrice' in product.toJSON(), false);
});

test('product model rejects missing SKU, duplicate variant SKU, negative stock and invalid pricing', () => {
  const missingSku = new Product({
    name: 'Bottle',
    slug: 'bottle',
    description: 'Steel bottle',
    categoryId,
    originalPrice: 10,
    sellingPrice: 10,
  });
  assert.ok(missingSku.validateSync().errors.sku);

  const invalid = new Product({
    name: 'T-shirt',
    slug: 't-shirt',
    description: 'Cotton t-shirt',
    categoryId,
    originalPrice: 10,
    sellingPrice: 11,
    stock: -1,
    variants: [
      {
        sku: 'DUP',
        attributes: { size: 'S' },
        originalPrice: 10,
        sellingPrice: 9,
        stock: 1,
      },
      {
        sku: 'DUP',
        attributes: { size: 'M' },
        originalPrice: 10,
        sellingPrice: 9,
        stock: 2,
      },
    ],
  });
  const error = invalid.validateSync();
  assert.ok(error.errors.variants);
  assert.ok(error.errors.sellingPrice);
  assert.ok(error.errors.stock);
});

test('inventory adjustment model captures actor, reason, and before/after quantities', () => {
  const adjustment = new InventoryAdjustment({
    productId: categoryId,
    sku: 'BTL-1',
    delta: -2,
    quantityBefore: 5,
    quantityAfter: 3,
    reason: 'Damaged stock',
    adjustedBy: categoryId,
  });
  assert.equal(adjustment.validateSync(), undefined);
  assert.equal(InventoryAdjustment.schema.indexes().some(([index]) =>
    index.productId === 1 && index.createdAt === -1), true);
});
