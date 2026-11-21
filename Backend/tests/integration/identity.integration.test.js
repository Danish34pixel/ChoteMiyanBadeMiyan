import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import AuthRateLimit from '../../src/modules/auth/models/auth-rate-limit.model.js';
import AuthSession from '../../src/modules/auth/models/auth-session.model.js';
import OtpChallenge from '../../src/modules/auth/models/otp-challenge.model.js';
import { createIdentityAccountService } from '../../src/modules/auth/services/identity-account.service.js';
import { createOtpService } from '../../src/modules/auth/services/otp.service.js';
import { createRateLimitService } from '../../src/modules/auth/services/rate-limit.service.js';
import { createSessionService } from '../../src/modules/auth/services/session.service.js';
import User from '../../src/modules/users/models/user.model.js';
import { createProfileService } from '../../src/modules/users/services/profile.service.js';
import { hashPassword } from '../../src/utils/password.js';
import { deriveKey, keyedHash } from '../../src/utils/identity-crypto.js';
import { getMongoIntegrationSkipReason } from '../helpers/mongodb.js';

const mongoTestUri = process.env.MONGODB_TEST_URI;
const integrationSkipReason = getMongoIntegrationSkipReason();

test(
  'customer identity persistence, OTP login, sessions, and addresses',
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

    try {
      await Promise.all([
        User.init(),
        OtpChallenge.init(),
        AuthSession.init(),
        AuthRateLimit.init(),
      ]);
    } catch (error) {
      await mongoose.disconnect();
      throw error;
    }

    const secret = Buffer.from('dedicated-mongodb-identity-test-secret');
    const otpKey = deriveKey(secret, 'customer-otp-hash-v1');
    const rateKey = deriveKey(secret, 'customer-rate-limit-v1');
    const proofKey = deriveKey(secret, 'customer-signup-proof-v1');
    const suffix = randomUUID();
    const makeMobile = () =>
      `+919${randomInt(100000000, 999999999)}`;
    const loginMobile = makeMobile();
    const signupMobile = makeMobile();
    const loginEmail = `identity-login-${suffix}@example.test`;
    const signupEmail = `identity-signup-${suffix}@example.test`;
    const ip = '198.51.100.55';
    const now = new Date();
    const sentCodes = [];
    const rateLimitService = createRateLimitService({
      model: AuthRateLimit,
    });
    const sessionService = createSessionService({
      sessionModel: AuthSession,
      userModel: User,
      authSecret: secret,
    });
    const otpService = createOtpService({
      challengeModel: OtpChallenge,
      userModel: User,
      rateLimitService,
      smsService: {
        async sendOtp(message) {
          sentCodes.push(message);
          return { developmentOtp: null };
        },
      },
      otpKey,
      rateKey,
      proofKey,
    });

    let existingUser;

    try {
      existingUser = await User.create({
        name: 'OTP Login Customer',
        email: loginEmail,
        password: await hashPassword('StrongPass123'),
        mobile: loginMobile,
        mobileVerifiedAt: now,
        role: 'customer',
      });

      await otpService.request({
        mobile: loginMobile,
        purpose: 'login',
        ip,
      });
      const loginResult = await otpService.verify({
        mobile: loginMobile,
        purpose: 'login',
        otp: sentCodes.at(-1).otp,
        ip,
        tokenService: sessionService,
      });

      assert.equal(loginResult.verified, true);
      assert.ok(loginResult.accessToken);
      const session = await AuthSession.findById(
        loginResult.refreshToken.split('.')[0],
      ).select('+refreshTokenHash');
      assert.notEqual(session.refreshTokenHash, loginResult.refreshToken);

      const signupRequest = await otpService.request({
        mobile: signupMobile,
        purpose: 'signup',
        ip,
      });
      assert.equal(signupRequest.accepted, true);
      const verification = await otpService.verify({
        mobile: signupMobile,
        purpose: 'signup',
        otp: sentCodes.at(-1).otp,
        ip,
      });
      const accountService = createIdentityAccountService({
        userModel: User,
        otpService,
      });
      const newUser = await accountService.registerMobileCustomer({
        name: 'OTP Signup Customer',
        email: signupEmail,
        password: 'StrongPass123',
        mobile: signupMobile,
        verificationToken: verification.verificationToken,
      });

      assert.equal(newUser.mobile, signupMobile);
      assert.ok(newUser.mobileVerifiedAt);

      const profileService = createProfileService({ userModel: User });
      const address = await profileService.addAddress(newUser.id, {
        name: 'Recipient',
        mobile: signupMobile,
        pinCode: '462001',
        city: 'Bhopal',
        state: 'Madhya Pradesh',
        addressLine: '12 Market Road',
      });
      assert.equal(address.city, 'Bhopal');
      assert.equal(
        (await profileService.listAddresses(newUser.id)).length,
        1,
      );

      const refreshed = await sessionService.refresh(loginResult.refreshToken);
      const authenticated = await sessionService.authenticateAccessToken(
        refreshed.accessToken,
      );
      await sessionService.revoke(
        authenticated.sessionId,
        String(existingUser._id),
      );
      await assert.rejects(
        sessionService.authenticateAccessToken(refreshed.accessToken),
        (error) => error.statusCode === 401,
      );
    } finally {
      try {
        const userIds = [existingUser?._id].filter(Boolean);
        const createdUsers = await User.find({
          mobile: { $in: [loginMobile, signupMobile] },
        }).select('_id');
        userIds.push(...createdUsers.map((user) => user._id));

        await Promise.all([
          User.deleteMany({ _id: { $in: userIds } }),
          OtpChallenge.deleteMany({
            mobile: { $in: [loginMobile, signupMobile] },
          }),
          AuthSession.deleteMany({ userId: { $in: userIds } }),
          AuthRateLimit.deleteMany({
            bucketKey: {
              $in: [
                ...['otp-request', 'otp-verify'].flatMap((action) => [
                  keyedHash(rateKey, `${action}:mobile:${loginMobile}`),
                  keyedHash(rateKey, `${action}:mobile:${signupMobile}`),
                  keyedHash(rateKey, `${action}:ip:${ip}`),
                ]),
              ],
            },
          }),
        ]);
      } finally {
        await mongoose.disconnect();
      }
    }
  },
);
