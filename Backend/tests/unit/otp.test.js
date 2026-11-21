import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../../src/utils/app-error.js';
import {
  generateOtp,
  hashOtp,
} from '../../src/utils/identity-crypto.js';
import { createOtpService, otpPolicy } from '../../src/modules/auth/services/otp.service.js';

const mobile = '+919876543210';
const ip = '127.0.0.1';
const secret = Buffer.from('unit-test-identity-secret');

function matches(record, query) {
  return Object.entries(query).every(([key, condition]) => {
    const value = record[key];

    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      return Object.entries(condition).every(([operator, expected]) => {
        if (operator === '$lt') return value < expected;
        if (operator === '$gt') return new Date(value) > expected;
        if (operator === '$ne') return value !== expected;
        return false;
      });
    }

    if (condition === null) return value == null;
    return String(value) === String(condition);
  });
}

function createHarness({
  existingUser = false,
  verifiedMobile = true,
  role = 'customer',
  smsFailure,
  now = new Date('2026-01-01T00:00:00.000Z'),
  rateLimitService,
} = {}) {
  let challenge;
  const sentCodes = [];
  const logs = [];
  const limits = [];
  const challengeModel = {
    findOne(query) {
      const record = challenge && matches(challenge, query) ? challenge : null;
      const result = Promise.resolve(record);
      result.select = () => result;
      return result;
    },
    async findOneAndUpdate(query, update, options = {}) {
      const current =
        challenge && matches(challenge, query) ? challenge : null;

      if (!current && !options.upsert) return null;
      challenge = current ?? { _id: 'challenge-1', ...query };

      if (update.$set) Object.assign(challenge, update.$set);
      if (update.$inc) {
        for (const [field, amount] of Object.entries(update.$inc)) {
          challenge[field] = (challenge[field] ?? 0) + amount;
        }
      }

      return challenge;
    },
    async deleteOne(query) {
      if (challenge && matches(challenge, query)) challenge = null;
    },
  };
  const service = createOtpService({
    challengeModel,
    userModel: {
      async exists(criteria) {
        if (criteria.mobileVerifiedAt) {
          return verifiedMobile ? { _id: 'customer-1' } : null;
        }
        return existingUser ? { _id: 'customer-1' } : null;
      },
      async findOne() {
        return existingUser
          ? { _id: 'customer-1', name: 'Customer', role }
          : null;
      },
    },
    rateLimitService:
      rateLimitService ??
      {
        async consume(input) {
          limits.push(input);
          return { allowed: true, retryAfterMs: 0 };
        },
      },
    smsService: {
      async sendOtp(message) {
        sentCodes.push(message);
        if (smsFailure) throw smsFailure;
        return { developmentOtp: message.otp };
      },
    },
    otpKey: secret,
    rateKey: secret,
    proofKey: secret,
    clock: () => new Date(now),
    createOtp: () => '123456',
    createToken: () => 'A'.repeat(43),
    logger: {
      error(event, fields) {
        logs.push({ event, ...fields });
      },
    },
  });

  return {
    service,
    sentCodes,
    logs,
    limits,
    get challenge() {
      return challenge;
    },
    setNow(value) {
      now = new Date(value);
    },
  };
}

test('OTP generation uses a six-digit cryptographically generated code', () => {
  assert.match(generateOtp(), /^\d{6}$/);
  assert.equal(otpPolicy.expiryMs, 5 * 60 * 1000);
  assert.equal(otpPolicy.resendCooldownMs, 60 * 1000);
  assert.equal(otpPolicy.maxAttempts, 5);
});

test('OTP requests store only a keyed hash and apply mobile and IP limits', async () => {
  const harness = createHarness();
  const result = await harness.service.request({
    mobile,
    purpose: 'signup',
    ip,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.developmentOtp, '123456');
  assert.notEqual(harness.challenge.codeHash, '123456');
  assert.equal(
    harness.challenge.codeHash,
    hashOtp(secret, mobile, 'signup', '123456'),
  );
  assert.equal(harness.challenge.attempts, 0);
  assert.equal(
    harness.challenge.expiresAt.getTime(),
    new Date('2026-01-01T00:00:00.000Z').getTime() + otpPolicy.expiryMs,
  );
  assert.equal(harness.limits.length, 2);
  assert.notEqual(harness.limits[0].bucketKey, harness.limits[1].bucketKey);
});

test('OTP resend is blocked until the cooldown expires', async () => {
  const harness = createHarness();
  await harness.service.request({ mobile, purpose: 'signup', ip });

  await assert.rejects(
    harness.service.request({ mobile, purpose: 'signup', ip }),
    (error) => error.statusCode === 429,
  );
  assert.equal(harness.sentCodes.length, 1);
});

test('OTP rate limits can reject mobile and IP buckets independently', async () => {
  for (const blockedCall of [1, 2]) {
    let calls = 0;
    const harness = createHarness({
      rateLimitService: {
        async consume() {
          calls += 1;
          return {
            allowed: calls !== blockedCall,
            retryAfterMs: 12000,
          };
        },
      },
    });

    test('login OTP is not sent to accounts without a verified mobile identity', async () => {
      const harness = createHarness({
        existingUser: true,
        verifiedMobile: false,
      });
      const result = await harness.service.request({
        mobile,
        purpose: 'login',
        ip,
      });

      assert.deepEqual(result, { accepted: true, developmentOtp: null });
      assert.equal(harness.sentCodes.length, 0);
    });

    await assert.rejects(
      harness.service.request({ mobile, purpose: 'signup', ip }),
      (error) => error.statusCode === 429 && error.retryAfterSeconds === 12,
    );
    assert.equal(calls, blockedCall);
    assert.equal(harness.sentCodes.length, 0);
  }
});

test('wrong OTP attempts are counted and capped', async () => {
  const harness = createHarness();
  await harness.service.request({ mobile, purpose: 'signup', ip });

  for (let attempt = 0; attempt < otpPolicy.maxAttempts; attempt += 1) {
    await assert.rejects(
      harness.service.verify({
        mobile,
        purpose: 'signup',
        otp: '000000',
        ip,
      }),
      (error) =>
        error.statusCode ===
        (attempt === otpPolicy.maxAttempts - 1 ? 429 : 400),
    );
  }

  assert.equal(harness.challenge.attempts, otpPolicy.maxAttempts);
  await assert.rejects(
    harness.service.verify({
      mobile,
      purpose: 'signup',
      otp: '123456',
      ip,
    }),
    (error) => error.statusCode === 429,
  );
});

test('expired OTPs are rejected', async () => {
  const harness = createHarness();
  await harness.service.request({ mobile, purpose: 'signup', ip });
  harness.setNow('2026-01-01T00:05:01.000Z');

  await assert.rejects(
    harness.service.verify({
      mobile,
      purpose: 'signup',
      otp: '123456',
      ip,
    }),
    (error) => error.statusCode === 400,
  );
});

test('verified OTPs cannot be reused and signup proofs can be consumed only once', async () => {
  const harness = createHarness();
  await harness.service.request({ mobile, purpose: 'signup', ip });
  const verification = await harness.service.verify({
    mobile,
    purpose: 'signup',
    otp: '123456',
    ip,
  });

  assert.equal(verification.verified, true);
  assert.match(verification.verificationToken, /^[A-Za-z0-9_-]{43}$/);
  await assert.rejects(
    harness.service.verify({
      mobile,
      purpose: 'signup',
      otp: '123456',
      ip,
    }),
    (error) => error.statusCode === 400,
  );

  await harness.service.consumeSignupVerification({
    mobile,
    verificationToken: verification.verificationToken,
  });
  await assert.rejects(
    harness.service.consumeSignupVerification({
      mobile,
      verificationToken: verification.verificationToken,
    }),
    (error) => error.statusCode === 400,
  );
});

test('login OTP verification issues tokens only for an active customer', async () => {
  const harness = createHarness({ existingUser: true });
  await harness.service.request({ mobile, purpose: 'login', ip });

  const result = await harness.service.verify({
    mobile,
    purpose: 'login',
    otp: '123456',
    ip,
    tokenService: {
      async createSession(user) {
        assert.equal(user._id, 'customer-1');
        return { accessToken: 'access', refreshToken: 'refresh' };
      },
    },
  });

  test('verified admin mobile OTP can issue an admin-scoped session', async () => {
    const harness = createHarness({
      existingUser: true,
      role: 'admin',
    });
    await harness.service.request({ mobile, purpose: 'login', ip });

    const result = await harness.service.verify({
      mobile,
      purpose: 'login',
      otp: '123456',
      ip,
      tokenService: {
        async createSession(user) {
          assert.equal(user.role, 'admin');
          return { accessToken: 'admin-access', refreshToken: 'admin-refresh' };
        },
      },
    });
    assert.equal(result.accessToken, 'admin-access');
  });

  assert.deepEqual(result, {
    verified: true,
    accessToken: 'access',
    refreshToken: 'refresh',
  });
});

test('failed SMS delivery removes the challenge and returns an explicit provider error', async () => {
  const providerError = new AppError('Unable to deliver verification code', 502);
  const harness = createHarness({ smsFailure: providerError });

  await assert.rejects(
    harness.service.request({ mobile, purpose: 'signup', ip }),
    (error) =>
      error.statusCode === 502 &&
      error.message === 'Unable to deliver verification code',
  );
  assert.equal(harness.challenge, null);
  assert.deepEqual(harness.logs, [
    {
      event: 'auth.otp.delivery_failed',
      provider: 'msg91',
      errorType: 'AppError',
    },
  ]);
  assert.equal(JSON.stringify(harness.logs).includes('123456'), false);
  assert.equal(JSON.stringify(harness.logs).includes(mobile), false);
});
