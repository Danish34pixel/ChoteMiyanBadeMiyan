import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductService } from '../../src/modules/products/services/product.service.js';

const categoryId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const subcategoryId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const actorId = 'cccccccccccccccccccccccc';

function createSession() {
  return {
    async withTransaction(work) {
      await work();
    },
    async endSession() {},
  };
}

test('product create records initial stock; update and delete deactivate safely', async () => {
  const products = new Map();
  const adjustments = [];
  class Product {
    constructor(fields) {
      Object.assign(this, fields);
      this.variants ??= [];
      this._id = 'dddddddddddddddddddddddd';
    }

    async save() {
      products.set(String(this._id), this);
      return this;
    }

    static async findById(id) {
      return products.get(String(id)) ?? null;
    }
  }
  const categoryModel = {
    async findById(id) {
      if (String(id) === categoryId) return { _id: categoryId, parentId: null };
      if (String(id) === subcategoryId) return { _id: subcategoryId, parentId: categoryId };
      return null;
    },
  };
  const service = createProductService({
    productModel: Product,
    categoryModel,
    inventoryAdjustmentModel: {
      async create(entries) {
        adjustments.push(...entries);
        return entries;
      },
    },
    startSession: async () => createSession(),
  });

  const product = await service.create(
    {
      name: 'Steel bottle',
      slug: 'steel-bottle',
      description: 'Insulated bottle',
      sku: 'BTL-001',
      categoryId,
      subcategoryId,
      originalPrice: 500,
      sellingPrice: 400,
      stock: 8,
      variants: [],
    },
    actorId,
  );
  assert.equal(product.stock, 8);
  assert.equal(adjustments.length, 1);
  assert.equal(adjustments[0].quantityAfter, 8);
  assert.equal(adjustments[0].adjustedBy, actorId);

  const updated = await service.update(product._id, { status: 'active' });
  assert.equal(updated.status, 'active');
  assert.deepEqual(await service.remove(product._id), {
    id: product._id,
    inactive: true,
  });
  assert.equal(product.status, 'inactive');
});

test('variant management records initial stock and prevents removing stocked variants', async () => {
  const productId = 'dddddddddddddddddddddddd';
  const variantId = 'eeeeeeeeeeeeeeeeeeeeeeee';
  class VariantList extends Array {
    id(id) {
      return this.find((variant) => String(variant._id) === String(id));
    }

    pull(id) {
      const index = this.findIndex((variant) => String(variant._id) === String(id));
      if (index >= 0) this.splice(index, 1);
    }
  }
  const product = {
    _id: productId,
    sku: null,
    originalPrice: 1000,
    sellingPrice: 800,
    stock: 0,
    variants: new VariantList(),
    async save() {},
  };
  const adjustments = [];
  function findProduct() {
    const result = Promise.resolve(product);
    result.session = async () => product;
    return result;
  }
  const service = createProductService({
    productModel: {
      findById: findProduct,
    },
    categoryModel: {},
    inventoryAdjustmentModel: {
      async create(entries) {
        adjustments.push(...entries);
        return entries;
      },
    },
    startSession: async () => createSession(),
  });
  const variant = await service.addVariant(
    productId,
    {
      sku: 'TS-S',
      attributes: { size: 'S', color: 'Blue' },
      originalPrice: 1000,
      sellingPrice: 800,
      stock: 3,
      lowStockThreshold: 2,
      images: [],
    },
    actorId,
  );
  variant._id = variantId;
  assert.equal(variant.stock, 3);
  assert.equal(adjustments[0].quantityAfter, 3);
  await service.updateVariant(productId, variantId, { sellingPrice: 750 });
  assert.equal(variant.sellingPrice, 750);
  await assert.rejects(
    service.removeVariant(productId, variantId),
    (error) => error.statusCode === 409,
  );
  variant.stock = 0;
  assert.deepEqual(await service.removeVariant(productId, variantId), {
    id: variantId,
    deleted: true,
  });
  assert.equal(product.sku, 'TS-S');
});

function matches(document, filter) {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$and') return condition.every((part) => matches(document, part));
    if (key === '$or') return condition.some((part) => matches(document, part));
    const value = document[key];
    if (condition instanceof RegExp) return condition.test(value);
    if (condition && typeof condition === 'object') {
      if ('$in' in condition) return condition.$in.some((item) => String(item) === String(value));
      if ('$gte' in condition && value < condition.$gte) return false;
      if ('$lte' in condition && value > condition.$lte) return false;
      return true;
    }
    return String(value) === String(condition);
  });
}

function query(rows, single = false) {
  let selected = rows;
  let skip = 0;
  let limit = rows.length;
  let sort = null;
  return {
    select() { return this; },
    sort(value) { sort = value; return this; },
    skip(value) { skip = value; return this; },
    limit(value) { limit = value; return this; },
    async lean() {
      const sorted = [...selected];
      if (sort) {
        const [field, direction] = Object.entries(sort)[0];
        sorted.sort((a, b) => direction * (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0));
      }
      const results = sorted.slice(skip, skip + limit);
      return single ? results[0] ?? null : results;
    },
    setRows(value) { selected = value; return this; },
  };
}

test('public product search escapes regex input and applies category, price, sorting and pagination', async () => {
  const categories = [
    { _id: categoryId, slug: 'home', status: 'active' },
    { _id: subcategoryId, slug: 'kitchen', status: 'active' },
  ];
  const products = [
    { _id: '1', name: 'Steel .* Bottle', description: 'Insulated', slug: 'bottle', status: 'active', categoryId, subcategoryId, sellingPrice: 100, minimumSellingPrice: 100, featured: true, createdAt: new Date('2026-01-01') },
    { _id: '2', name: 'Steel Bottle', description: 'Insulated', slug: 'steel-bottle', status: 'active', categoryId, subcategoryId: null, sellingPrice: 200, minimumSellingPrice: 200, featured: false, createdAt: new Date('2026-01-02') },
    { _id: '3', name: 'Steel Bottle', description: 'Insulated', slug: 'draft', status: 'draft', categoryId, subcategoryId: null, sellingPrice: 150, minimumSellingPrice: 150, createdAt: new Date('2026-01-03') },
  ];
  const categoryModel = {
    find(filter) {
      const rows = categories.filter((category) => matches(category, filter));
      return query(rows);
    },
    findOne(filter) {
      return query(
        categories.filter((category) => matches(category, filter)),
        true,
      );
    },
  };
  const productModel = {
    find(filter) {
      return query(products.filter((product) => matches(product, filter)));
    },
    async countDocuments(filter) {
      return products.filter((product) => matches(product, filter)).length;
    },
  };
  const service = createProductService({
    productModel,
    categoryModel,
    inventoryAdjustmentModel: {},
  });

  const result = await service.listPublic({
    q: '.*',
    category: 'home',
    featured: true,
    minPrice: 50,
    maxPrice: 150,
    sort: 'price_asc',
    page: 1,
    limit: 1,
  });
  assert.equal(result.pagination.total, 1);
  assert.equal(result.products[0].slug, 'bottle');
  assert.equal(result.products[0].priceFrom, 100);
  assert.equal(result.pagination.pages, 1);
});

test('admin product search matches names and base or variant SKUs literally', async () => {
  let capturedFilter;
  const service = createProductService({
    productModel: {
      find(filter) {
        capturedFilter = filter;
        return query([]);
      },
      async countDocuments() {
        return 0;
      },
    },
    categoryModel: {},
    inventoryAdjustmentModel: {},
  });

  await service.listAdmin({ page: 1, limit: 20, q: 'a+b' });

  assert.deepEqual(Object.keys(capturedFilter.$or), ['0', '1', '2']);
  assert.deepEqual(capturedFilter.$or.map(({ name, sku, 'variants.sku': variantSku }) => {
    const expression = name ?? sku ?? variantSku;
    return expression.source;
  }), ['a\\+b', 'a\\+b', 'a\\+b']);
});
