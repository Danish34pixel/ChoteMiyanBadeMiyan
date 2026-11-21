import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import AuthSession from '../../src/modules/auth/models/auth-session.model.js';
import User from '../../src/modules/users/models/user.model.js';
import { startTestServer } from '../helpers/http.js';
import { getMongoIntegrationSkipReason } from '../helpers/mongodb.js';

const mongoTestUri = process.env.MONGODB_TEST_URI;
const integrationSkipReason = getMongoIntegrationSkipReason();

test(
  'email and password customer authentication',
  { skip: integrationSkipReason },
  async (t) => {
    try {
      await mongoose.connect(mongoTestUri, { serverSelectionTimeoutMS: 5000 });
    } catch (error) {
      if (error.name !== 'MongooseServerSelectionError') throw error;

      await mongoose.disconnect();
      t.skip('Dedicated MongoDB test database is unavailable');
      return;
    }

    const testServer = await startTestServer(app);
    const baseUrl = `${testServer.baseUrl}/api/v1/auth`;
    const email = `auth-${randomUUID()}@example.com`;
    const password = 'StrongPass123';
    let userId;

    try {
      const signupResponse = await fetch(`${baseUrl}/signup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Test Customer', email, password }),
      });
      const signupBody = await signupResponse.json();

      assert.equal(signupResponse.status, 201);
      assert.equal(signupBody.success, true);
      assert.equal('password' in signupBody.data.user, false);
      userId = signupBody.data.user.id;

      const storedUser = await User.findById(userId).select('+password');
      assert.ok(storedUser);
      assert.match(storedUser.password, /^\$2[aby]\$12\$/);
      assert.equal(await bcrypt.compare(password, storedUser.password), true);

      const loginResponse = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.toUpperCase(), password }),
      });
      const loginBody = await loginResponse.json();

      assert.equal(loginResponse.status, 200);
      assert.equal(loginBody.success, true);
      assert.equal(loginBody.data.user.email, email);
      assert.equal('password' in loginBody.data.user, false);
      assert.equal(JSON.stringify(loginBody).includes(storedUser.password), false);
      assert.equal(typeof loginBody.data.accessToken, 'string');
      assert.equal(typeof loginBody.data.refreshToken, 'string');

      const wrongPasswordResponse = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'IncorrectPass123' }),
      });
      const wrongPasswordBody = await wrongPasswordResponse.json();

      assert.equal(wrongPasswordResponse.status, 401);
      assert.equal(wrongPasswordBody.success, false);
      assert.equal(wrongPasswordBody.message, 'Invalid email or password');
      assert.equal(wrongPasswordBody.data, undefined);

      const duplicateResponse = await fetch(`${baseUrl}/signup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Duplicate', email, password }),
      });
      assert.equal(duplicateResponse.status, 409);

      const logoutResponse = await fetch(`${baseUrl}/logout`, {
        method: 'POST',
        headers: { authorization: `Bearer ${loginBody.data.accessToken}` },
      });
      assert.equal(logoutResponse.status, 200);

      const revokedResponse = await fetch(
        `${testServer.baseUrl}/api/v1/customer/me`,
        {
          headers: { authorization: `Bearer ${loginBody.data.accessToken}` },
        },
      );
      assert.equal(revokedResponse.status, 401);
    } finally {
      if (userId) {
        await AuthSession.deleteMany({ userId });
        await User.deleteOne({ _id: userId, email });
      }
      await testServer.close();
      await mongoose.disconnect();
    }
  },
);
