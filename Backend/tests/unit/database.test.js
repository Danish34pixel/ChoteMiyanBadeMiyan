import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { connectDatabase } from '../../src/config/database.js';

test('database connection uses the supplied MongoDB URI', async (t) => {
  const uri = 'mongodb://127.0.0.1:27017/connection-test';
  let receivedUri;

  t.mock.method(mongoose, 'connect', async (connectionUri) => {
    receivedUri = connectionUri;
    return mongoose;
  });

  await connectDatabase(uri);

  assert.equal(receivedUri, uri);
});
