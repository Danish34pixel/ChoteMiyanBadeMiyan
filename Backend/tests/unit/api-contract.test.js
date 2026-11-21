import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../../src/app.js';
import { startTestServer } from '../helpers/http.js';

test('unknown routes use the common error response and request ID', async () => {
  const testServer = await startTestServer(app);

  try {
    const response = await fetch(`${testServer.baseUrl}/missing`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.message, 'Route not found');
    assert.equal(body.requestId, response.headers.get('x-request-id'));
  } finally {
    await testServer.close();
  }
});

test('malformed JSON uses the common client-error response', async () => {
  const testServer = await startTestServer(app);

  try {
    const response = await fetch(
      `${testServer.baseUrl}/api/v1/auth/signup`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"name":',
      },
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.message, 'Request body must contain valid JSON');
    assert.equal(body.requestId, response.headers.get('x-request-id'));
  } finally {
    await testServer.close();
  }
});
