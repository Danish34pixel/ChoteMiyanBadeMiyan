import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../../src/app.js';
import { getAllowedOrigins } from '../../src/config/env.js';
import { startTestServer } from '../helpers/http.js';

test('security headers are applied and the Express signature is hidden', async () => {
  const testServer = await startTestServer(app);

  try {
    const response = await fetch(`${testServer.baseUrl}/health/live`);

    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-powered-by'), null);
  } finally {
    await testServer.close();
  }
});

test('CORS allows configured origins and rejects unconfigured origins', async () => {
  const testServer = await startTestServer(app);
  const allowedOrigins = getAllowedOrigins();
  const allowedOrigin = allowedOrigins[0];
  let blockedOrigin = 'https://blocked-origin.invalid';
  let suffix = 0;

  while (allowedOrigins.includes(blockedOrigin)) {
    suffix += 1;
    blockedOrigin = `https://blocked-${suffix}.invalid`;
  }

  try {
    if (allowedOrigin) {
      const allowedResponse = await fetch(`${testServer.baseUrl}/health/live`, {
        headers: { Origin: allowedOrigin },
      });

      assert.equal(
        allowedResponse.headers.get('access-control-allow-origin'),
        allowedOrigin,
      );
    }

    const blockedResponse = await fetch(`${testServer.baseUrl}/health/live`, {
      headers: { Origin: blockedOrigin },
    });
    const body = await blockedResponse.json();

    assert.equal(blockedResponse.status, 403);
    assert.equal(body.success, false);
    assert.equal(body.message, 'Origin is not allowed');
    assert.equal(
      blockedResponse.headers.get('access-control-allow-origin'),
      null,
    );
  } finally {
    await testServer.close();
  }
});
