import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../../src/app.js';
import { startTestServer } from '../helpers/http.js';

test('public catalog validates filters and admin catalog endpoints require authentication', async () => {
  const server = await startTestServer(app);
  try {
    const invalidSort = await fetch(
      `${server.baseUrl}/api/v1/products?sort=popular`,
    );
    const invalidSortBody = await invalidSort.json();
    assert.equal(invalidSort.status, 400);
    assert.equal(invalidSortBody.success, false);

    const invalidPrice = await fetch(
      `${server.baseUrl}/api/v1/products?minPrice=200&maxPrice=100`,
    );
    assert.equal(invalidPrice.status, 400);

    for (const path of [
      '/api/v1/admin/categories',
      '/api/v1/admin/products',
      '/api/v1/admin/inventory/adjustments?productId=aaaaaaaaaaaaaaaaaaaaaaaa',
    ]) {
      const response = await fetch(`${server.baseUrl}${path}`);
      const body = await response.json();
      assert.equal(response.status, 401, path);
      assert.equal(body.success, false, path);
    }
  } finally {
    await server.close();
  }
});
