import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import { startTestServer } from '../helpers/http.js';

test('liveness health check does not depend on MongoDB', async () => {
  const testServer = await startTestServer(app);

  try {
    const response = await fetch(`${testServer.baseUrl}/health/live`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: { status: 'alive' },
    });
  } finally {
    await testServer.close();
  }
});

test('readiness health check reflects the current MongoDB connection state', async () => {
  const testServer = await startTestServer(app);

  try {
    const response = await fetch(`${testServer.baseUrl}/health/ready`);
    const body = await response.json();
    const connected = mongoose.connection.readyState === 1;

    assert.equal(response.status, connected ? 200 : 503);
    assert.equal(body.success, connected);
    assert.equal(body.data.status, connected ? 'ready' : 'not_ready');
    assert.equal(
      body.data.dependencies.database,
      connected ? 'connected' : 'disconnected',
    );
  } finally {
    await testServer.close();
  }
});
