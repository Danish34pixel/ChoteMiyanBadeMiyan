import assert from 'node:assert/strict';
import test from 'node:test';
import { productCreateSchema } from '../../src/modules/products/validators/product.validator.js';

test('new products default to active so they appear in the storefront', () => {
  const product = productCreateSchema.parse({
    name: 'Electric kettle',
    slug: 'electric-kettle',
    description: 'A sample product',
    sku: 'KETTLE-1',
    categoryId: '507f1f77bcf86cd799439011',
    originalPrice: 1000,
    sellingPrice: 900,
  });

  assert.equal(product.status, 'active');
});
