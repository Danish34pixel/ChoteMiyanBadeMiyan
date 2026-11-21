import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import User from '../../src/modules/users/models/user.model.js';
import { startTestServer } from '../helpers/http.js';
import { getMongoIntegrationSkipReason } from '../helpers/mongodb.js';

const mongoTestUri = process.env.MONGODB_TEST_URI;
const integrationSkipReason = getMongoIntegrationSkipReason();

test(
  'customer signup API',
  { skip: integrationSkipReason },
  async (t) => {
    try {
      await mongoose.connect(mongoTestUri, { serverSelectionTimeoutMS: 5000 });
    } catch (error) {
      if (error.name !== 'MongooseServerSelectionError') {
        throw error;
      }

      await mongoose.disconnect();
      t.skip('Dedicated MongoDB test database is unavailable');
      return;
    }

    const testServer = await startTestServer(app);
    const baseUrl = `${testServer.baseUrl}/api/v1/auth/signup`;
    const email = `signup-${randomUUID()}@example.com`;

    try {
      await t.test('rejects a missing name', async () => {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email,
            password: 'StrongPass123',
          }),
        });

        assert.equal(response.status, 400);
        assert.equal((await response.json()).success, false);
      });

      await t.test('rejects an invalid email', async () => {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Danish Khan',
            email: 'invalid-email',
            password: 'StrongPass123',
          }),
        });

        assert.equal(response.status, 400);
      });

      await t.test('rejects a password shorter than 8 characters', async () => {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Danish Khan',
            email,
            password: 'short',
          }),
        });

        assert.equal(response.status, 400);
      });

      await t.test('creates a customer and never returns the password', async () => {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Danish Khan',
            email: email.toUpperCase(),
            password: 'StrongPass123',
            role: 'admin',
          }),
        });
        const body = await response.json();

        assert.equal(response.status, 201);
        assert.equal(body.success, true);
        assert.equal(body.data.user.email, email);
        assert.equal(body.data.user.role, 'customer');
        assert.equal('password' in body.data.user, false);
        assert.equal(JSON.stringify(body).includes('StrongPass123'), false);

        const storedUser = await User.findById(body.data.user.id).select('+password');
        assert.ok(storedUser);
        assert.notEqual(storedUser.password, 'StrongPass123');
        assert.equal(await bcrypt.compare('StrongPass123', storedUser.password), true);
      });

      await t.test('rejects duplicate email addresses with HTTP 409', async () => {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Another Customer',
            email,
            password: 'StrongPass123',
          }),
        });

        assert.equal(response.status, 409);
        assert.equal((await response.json()).success, false);
      });
    } finally {
      await User.deleteOne({ email });
      await testServer.close();
      await mongoose.disconnect();
    }
  },
);
