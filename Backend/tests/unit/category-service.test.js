import assert from 'node:assert/strict';
import test from 'node:test';
import { createCategoryService } from '../../src/modules/categories/services/category.service.js';

const parentId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const childId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const productId = 'cccccccccccccccccccccccc';

function createHarness() {
  const rows = new Map();
  const productRows = [];
  class Category {
    constructor(fields) {
      Object.assign(this, fields);
    }

    async save() {
      this._id ??= rows.size ? childId : parentId;
      rows.set(String(this._id), this);
      return this;
    }

    async deleteOne() {
      rows.delete(String(this._id));
    }
  }
  Category.findById = async (id) => rows.get(String(id)) ?? null;
  Category.create = async (fields) => new Category(fields).save();
  Category.exists = async ({ parentId: targetParent }) =>
    [...rows.values()].some((row) => String(row.parentId) === String(targetParent));
  const productModel = {
    async exists(filter) {
      const conditions = filter.$or ?? [filter];
      return productRows.some((product) =>
        conditions.some((condition) =>
          Object.entries(condition).some(([field, value]) =>
            String(product[field]) === String(value),
          ),
        ),
      );
    },
  };
  return {
    service: createCategoryService({
      categoryModel: Category,
      productModel,
    }),
    rows,
    productRows,
  };
}

test('category create, update and delete enforce parent and dependency rules', async () => {
  const harness = createHarness();
  const parent = await harness.service.create({
    name: 'Home',
    slug: 'home',
    parentId: null,
  });
  const child = await harness.service.create({
    name: 'Kitchen',
    slug: 'kitchen',
    parentId: parent._id,
  });
  assert.equal(String(child.parentId), String(parent._id));

  await assert.rejects(
    harness.service.update(parent._id, { parentId: child._id }),
    (error) => error.statusCode === 400,
  );
  await assert.rejects(
    harness.service.remove(parent._id),
    (error) => error.statusCode === 409,
  );

  harness.productRows.push({ _id: productId, subcategoryId: child._id });
  await assert.rejects(
    harness.service.update(child._id, { parentId: null }),
    (error) => error.statusCode === 409,
  );
  await assert.rejects(
    harness.service.remove(child._id),
    (error) => error.statusCode === 409,
  );
  harness.productRows.length = 0;
  assert.deepEqual(await harness.service.remove(child._id), {
    id: childId,
    deleted: true,
  });
  assert.deepEqual(await harness.service.remove(parent._id), {
    id: parentId,
    deleted: true,
  });
});
