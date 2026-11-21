import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionService } from '../../src/modules/auth/services/session.service.js';

const userId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const sessionId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const user = {
  _id: userId,
  role: 'customer',
  isActive: true,
};
const admin = { ...user, role: 'admin' };

function createHarness() {
  let now = new Date('2026-01-01T00:00:00.000Z');
  const records = new Map();
  let tokenSequence = 0;

  function matches(record, query) {
    return Object.entries(query).every(([key, condition]) => {
      const value = record[key];

      if (condition && typeof condition === 'object') {
        if ('$gt' in condition) {
          return new Date(value) > condition.$gt;
        }
      }

      if (condition === null) return value == null;
      return String(value) === String(condition);
    });
  }

  class Session {
    constructor(fields) {
      this._id = sessionId;
      Object.assign(this, fields);
    }

    async save() {
      records.set(String(this._id), this);
    }

    static async findOneAndUpdate(query, update) {
      const record = records.get(String(query._id));
      if (!record || !matches(record, query)) return null;
      Object.assign(record, update.$set);
      return record;
    }

    static async updateOne(query, update) {
      const record = records.get(String(query._id));
      if (record && matches(record, query)) {
        Object.assign(record, update.$set);
      }
    }

    static async exists(query) {
      const record = records.get(String(query._id));
      return Boolean(record && matches(record, query));
    }
  }

  const service = createSessionService({
    sessionModel: Session,
    userModel: {
      async findOne(query) {
        if (query.isActive !== true) return null;
        if (query.role === 'customer') return user;
        if (query.role === 'admin') return admin;
        return null;
      },
    },
    authSecret: 'test-secret-with-at-least-thirty-two-characters',
    clock: () => new Date(now),
    createToken() {
      tokenSequence += 1;
      return String.fromCharCode(64 + tokenSequence).repeat(43);
    },
  });

  return {
    service,
    records,
    setNow(value) {
      now = new Date(value);
    },
  };
}

test('session creation issues signed short-lived access and opaque refresh tokens', async () => {
  const harness = createHarness();
  const tokens = await harness.service.createSession(user);

  assert.equal(tokens.tokenType, 'Bearer');
  assert.equal(tokens.expiresIn, 600);
  assert.equal(tokens.refreshExpiresIn, 30 * 24 * 60 * 60);
  assert.match(tokens.accessToken.split('.')[0], /^[A-Za-z0-9_-]+$/);
  assert.match(tokens.refreshToken, new RegExp(`^${sessionId}\\.[A-Za-z0-9_-]{43}$`));
  assert.notEqual(
    harness.records.get(sessionId).refreshTokenHash,
    tokens.refreshToken,
  );
  assert.deepEqual(
    await harness.service.authenticateAccessToken(tokens.accessToken),
    { user, sessionId },
  );
});

test('admin sessions preserve admin role through access and refresh token rotation', async () => {
  const harness = createHarness();
  const first = await harness.service.createSession(admin);
  assert.deepEqual(
    await harness.service.authenticateAccessToken(first.accessToken),
    { user: admin, sessionId },
  );
  const refreshed = await harness.service.refresh(first.refreshToken);
  assert.deepEqual(
    await harness.service.authenticateAccessToken(refreshed.accessToken),
    { user: admin, sessionId },
  );
});

test('refresh rotates the token and a reused refresh token revokes the session', async () => {
  const harness = createHarness();
  const first = await harness.service.createSession(user);
  const second = await harness.service.refresh(first.refreshToken);

  assert.notEqual(second.refreshToken, first.refreshToken);
  assert.deepEqual(
    await harness.service.authenticateAccessToken(second.accessToken),
    { user, sessionId },
  );

  await assert.rejects(
    harness.service.refresh(first.refreshToken),
    (error) => error.statusCode === 401,
  );
  await assert.rejects(
    harness.service.authenticateAccessToken(second.accessToken),
    (error) => error.statusCode === 401,
  );
});

test('logout revokes the session and expires access tokens are rejected', async () => {
  const harness = createHarness();
  const tokens = await harness.service.createSession(user);
  await harness.service.revoke(sessionId, userId);

  await assert.rejects(
    harness.service.authenticateAccessToken(tokens.accessToken),
    (error) => error.statusCode === 401,
  );

  const expiringHarness = createHarness();
  const expiringTokens = await expiringHarness.service.createSession(user);
  expiringHarness.setNow('2026-01-01T00:11:00.000Z');
  await assert.rejects(
    expiringHarness.service.authenticateAccessToken(
      expiringTokens.accessToken,
    ),
    (error) => error.statusCode === 401,
  );
});

test('invalid or malformed access tokens are rejected', async () => {
  const harness = createHarness();

  await assert.rejects(
    harness.service.authenticateAccessToken('not-a-token'),
    (error) => error.statusCode === 401,
  );

  const tokens = await harness.service.createSession(user);
  const [header, payload, signature] = tokens.accessToken.split('.');
  const changedPayload =
    (payload[0] === 'A' ? 'B' : 'A') + payload.slice(1);
  const changedToken = `${header}.${changedPayload}.${signature}`;
  await assert.rejects(
    harness.service.authenticateAccessToken(changedToken),
    (error) => error.statusCode === 401,
  );
});
