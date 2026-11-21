import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { createAdminPasswordAuthService } from '../../src/modules/auth/services/admin-password-auth.service.js';
import { deriveKey } from '../../src/utils/identity-crypto.js';

function query(value) {
  const result = Promise.resolve(value);
  result.select = () => result;
  return result;
}

test('admin password login normalizes email and issues a session only to an active admin', async () => {
  const secret = 'admin-password-test-secret-with-at-least-thirty-two-characters';
  const password = 'StrongPass123';
  const admin = {
    id: 'admin-id',
    role: 'admin',
    isActive: true,
    password: await bcrypt.hash(password, 4),
  };
  const rateLimitCalls = [];
  let userQuery;
  const service = createAdminPasswordAuthService({
    userModel: {
      findOne(queryFilter) {
        userQuery = queryFilter;
        return query(admin);
      },
    },
    rateLimitService: {
      async consume(input) {
        rateLimitCalls.push(input);
        return { allowed: true, retryAfterMs: 0 };
      },
    },
    rateKey: deriveKey(secret, 'admin-password-test-rate'),
    sessionService: {
      async createSession(user) {
        assert.equal(user, admin);
        return { accessToken: 'access-token', refreshToken: 'refresh-token' };
      },
    },
  });

  const result = await service.login({
    email: ' ADMIN@EXAMPLE.COM ',
    password,
    ip: '127.0.0.1',
  });

  assert.equal(userQuery.email, 'admin@example.com');
  assert.equal(userQuery.role, 'admin');
  assert.equal(userQuery.isActive, true);
  assert.equal(result.user, admin);
  assert.equal(result.accessToken, 'access-token');
  assert.equal(rateLimitCalls.length, 2);
  assert.ok(rateLimitCalls.every((call) => call.limit === 5));
  assert.ok(rateLimitCalls.every((call) => call.bucketKey !== 'admin@example.com'));
});

test('admin password login returns a generic unauthorized error for invalid credentials', async () => {
  const service = createAdminPasswordAuthService({
    userModel: {
      findOne() {
        return query(null);
      },
    },
    rateLimitService: {
      async consume() {
        return { allowed: true, retryAfterMs: 0 };
      },
    },
    rateKey: deriveKey('test-secret', 'admin-password-test-rate'),
    sessionService: {
      async createSession() {
        throw new Error('Should not create a session');
      },
    },
  });

  await assert.rejects(
    service.login({
      email: 'customer@example.com',
      password: 'StrongPass123',
      ip: '127.0.0.1',
    }),
    (error) =>
      error.statusCode === 401 &&
      error.message === 'Invalid email or password',
  );
});

test('admin password login stops when its rate limit is exceeded', async () => {
  let databaseQueried = false;
  const service = createAdminPasswordAuthService({
    userModel: {
      findOne() {
        databaseQueried = true;
        return query(null);
      },
    },
    rateLimitService: {
      async consume() {
        return { allowed: false, retryAfterMs: 30_000 };
      },
    },
    rateKey: deriveKey('test-secret', 'admin-password-test-rate'),
    sessionService: {
      async createSession() {
        throw new Error('Should not create a session');
      },
    },
  });

  await assert.rejects(
    service.login({
      email: 'admin@example.com',
      password: 'StrongPass123',
      ip: '127.0.0.1',
    }),
    (error) => error.statusCode === 429,
  );
  assert.equal(databaseQueried, false);
});
