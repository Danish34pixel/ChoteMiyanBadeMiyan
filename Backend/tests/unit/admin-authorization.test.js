import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoleAuth } from '../../src/modules/auth/middlewares/role-auth.js';

function requestWith(token) {
  return {
    get(name) {
      return name.toLowerCase() === 'authorization' ? `Bearer ${token}` : undefined;
    },
  };
}

test('admin role middleware accepts an authenticated provisioned admin only', async () => {
  const adminUser = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', role: 'admin' };
  const middleware = createRoleAuth('admin', () => ({
    async authenticateAccessToken(token) {
      assert.equal(token, 'valid');
      return { user: adminUser, sessionId: 'session' };
    },
  }));
  const req = requestWith('valid');
  let nextCalled = false;
  await middleware(req, {}, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req.auth.role, 'admin');
  assert.equal(req.auth.userId, adminUser._id);
});

test('admin role middleware rejects customer identities and malformed credentials', async () => {
  const middleware = createRoleAuth('admin', () => ({
    async authenticateAccessToken() {
      return {
        user: { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', role: 'customer' },
        sessionId: 'session',
      };
    },
  }));
  await assert.rejects(
    middleware(requestWith('valid'), {}, () => {}),
    (error) => error.statusCode === 403,
  );
  await assert.rejects(
    middleware({ get: () => 'Basic invalid' }, {}, () => {}),
    (error) => error.statusCode === 401,
  );
});
