import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';
import { requestId } from '../../src/middlewares/request-id.js';
import { createRequestLogger } from '../../src/middlewares/request-logger.js';
import { createLogger } from '../../src/utils/logger.js';
import { startTestServer } from '../helpers/http.js';

test('structured logger writes JSON with timestamp, level, event, and fields', () => {
  const entries = [];
  const sink = {
    log(value) {
      entries.push(JSON.parse(value));
    },
    warn(value) {
      entries.push(JSON.parse(value));
    },
    error(value) {
      entries.push(JSON.parse(value));
    },
  };

  createLogger(sink).info('test.event', { requestId: 'request-123' });

  assert.equal(entries.length, 1);
  assert.match(entries[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(entries[0].level, 'info');
  assert.equal(entries[0].event, 'test.event');
  assert.equal(entries[0].requestId, 'request-123');
});

test('HTTP request logs use route patterns and omit query strings and path values', async () => {
  const entries = [];
  const app = express();
  const requestLogger = createRequestLogger({
    info(event, fields) {
      entries.push({ event, ...fields });
    },
  });

  app.use(requestId, requestLogger);
  app.get('/items/:itemId', (_req, res) => res.sendStatus(200));

  const testServer = await startTestServer(app);

  try {
    const response = await fetch(
      `${testServer.baseUrl}/items/private-item?token=private-query`,
    );
    await response.arrayBuffer();

    assert.equal(response.status, 200);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].event, 'http.request.completed');
    assert.equal(entries[0].route, '/items/:itemId');
    assert.equal(entries[0].method, 'GET');
    assert.equal(entries[0].statusCode, 200);
    assert.equal('private-item' in entries[0], false);
    assert.equal(JSON.stringify(entries[0]).includes('private-query'), false);
    assert.equal(response.headers.get('x-request-id'), entries[0].requestId);
  } finally {
    await testServer.close();
  }
});
