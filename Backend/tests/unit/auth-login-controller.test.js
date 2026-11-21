import assert from 'node:assert/strict';
import test from 'node:test';
import { authenticateUserLogin } from '../../src/modules/auth/controllers/auth.controller.js';

function query(value) {
  const result = Promise.resolve(value);
  result.select = () => result;
  return result;
}

test('normal login delegates administrator credentials to the rate-limited admin authenticator', async () => {
  const admin = { id: 'admin-id', role: 'admin' };
  const adminSession = {
    user: admin,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  };
  let userQuery;
  let loginCredentials;
  const runtime = {
    userModel: {
      findOne(filter) {
        userQuery = filter;
        return query(admin);
      },
    },
    adminPasswordAuthService: {
      async login(credentials) {
        loginCredentials = credentials;
        return adminSession;
      },
    },
    sessionService: {
      async createSession() {
        throw new Error('Admin sessions must use the admin authenticator');
      },
    },
  };

  const result = await authenticateUserLogin(
    {
      email: ' ADMIN@EXAMPLE.COM ',
      password: 'StrongPass123',
      ip: '127.0.0.1',
    },
    runtime,
  );

  assert.deepEqual(userQuery, { email: 'admin@example.com' });
  assert.deepEqual(loginCredentials, {
    email: 'admin@example.com',
    password: 'StrongPass123',
    ip: '127.0.0.1',
  });
  assert.equal(result, adminSession);
});
