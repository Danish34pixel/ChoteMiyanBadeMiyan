import assert from 'node:assert/strict';
import test from 'node:test';
import { createInventoryService } from '../../src/modules/inventory/services/inventory.service.js';

const productId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const variantId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const adminId = 'cccccccccccccccccccccccc';

function createHarness() {
  const product = {
    _id: productId,
    sku: 'BOTTLE',
    stock: 3,
    variants: [],
    async save() {},
  };
  const ledger = [];
  const session = {
    async withTransaction(work) {
      await work();
    },
    async endSession() {},
  };
  return {
    product,
    ledger,
    service: createInventoryService({
      productModel: {
        findById: () => ({ session: async () => product }),
      },
      adjustmentModel: {
        async create(entries) {
          ledger.push(...entries);
          return entries;
        },
      },
      startSession: async () => session,
    }),
  };
}

test('inventory adjustments are atomic, attributed and recorded with before/after stock', async () => {
  const harness = createHarness();
  const adjustment = await harness.service.adjust(
    {
      productId,
      delta: 4,
      reason: 'Restocked',
    },
    adminId,
  );
  assert.equal(harness.product.stock, 7);
  assert.equal(adjustment.quantityBefore, 3);
  assert.equal(adjustment.quantityAfter, 7);
  assert.equal(adjustment.adjustedBy, adminId);
  assert.equal(harness.ledger.length, 1);
});

test('inventory adjustments reject negative stock and require a variant where applicable', async () => {
  const harness = createHarness();
  await assert.rejects(
    harness.service.adjust(
      { productId, delta: -4, reason: 'Correction' },
      adminId,
    ),
    (error) => error.statusCode === 409,
  );
  harness.product.variants = [{ _id: variantId, sku: 'SHIRT-S', stock: 2 }];
  await assert.rejects(
    harness.service.adjust(
      { productId, delta: 1, reason: 'Restock' },
      adminId,
    ),
    (error) => error.statusCode === 400,
  );
});
