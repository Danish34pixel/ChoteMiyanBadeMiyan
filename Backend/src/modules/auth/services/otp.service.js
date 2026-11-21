import { AppError } from '../../../utils/app-error.js';
import {
  generateOpaqueToken,
  generateOtp,
  hashOtp,
  keyedHash,
  secureEqual,
} from '../../../utils/identity-crypto.js';

const OTP_LIFETIME_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function rateLimitError(retryAfterMs) {
  const error = new AppError('Too many verification requests; try again later', 429);
  error.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return error;
}

function invalidCodeError() {
  return new AppError('Verification code is invalid or expired', 400);
}

export function createOtpService({
  challengeModel,
  userModel,
  rateLimitService,
  smsService,
  otpKey,
  rateKey,
  proofKey,
  clock = () => new Date(),
  createOtp = generateOtp,
  createToken = generateOpaqueToken,
  logger,
}) {
  function makeBucketKey(scope, identifier) {
    return keyedHash(rateKey, `${scope}:${identifier}`);
  }

  async function checkRateLimit(action, mobile, ip, limits) {
    const mobileLimit = await rateLimitService.consume({
      bucketKey: makeBucketKey(`${action}:mobile`, mobile),
      limit: limits.mobile,
      windowMs: RATE_WINDOW_MS,
    });

    if (!mobileLimit.allowed) {
      throw rateLimitError(mobileLimit.retryAfterMs);
    }

    const ipLimit = await rateLimitService.consume({
      bucketKey: makeBucketKey(`${action}:ip`, ip),
      limit: limits.ip,
      windowMs: RATE_WINDOW_MS,
    });

    if (!ipLimit.allowed) {
      throw rateLimitError(ipLimit.retryAfterMs);
    }
  }

  return {
    async request({ mobile, purpose, ip }) {
      const now = clock();
      await checkRateLimit('otp-request', mobile, ip, {
        mobile: 3,
        ip: 20,
      });

      const userCriteria = {
        mobile,
      };
      const userExists = await userModel.exists(userCriteria);
      const eligible =
        purpose === 'signup'
          ? !userExists
          : Boolean(
              await userModel.exists({
                ...userCriteria,
                role: { $in: ['customer', 'admin'] },
                isActive: true,
                mobileVerifiedAt: { $ne: null },
              }),
            );

      if (!eligible) {
        return { accepted: true, developmentOtp: null };
      }

      const existingChallenge = await challengeModel.findOne({
        mobile,
        purpose,
      });

      if (
        existingChallenge?.resendAvailableAt &&
        new Date(existingChallenge.resendAvailableAt) > now
      ) {
        throw rateLimitError(
          new Date(existingChallenge.resendAvailableAt).getTime() -
            now.getTime(),
        );
      }

      const otp = createOtp();
      const codeHash = hashOtp(otpKey, mobile, purpose, otp);
      const challengeUpdate = {
        $set: {
          codeHash,
          expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS),
          resendAvailableAt: new Date(now.getTime() + RESEND_COOLDOWN_MS),
          attempts: 0,
          verifiedAt: null,
          verificationTokenHash: null,
          consumedAt: null,
        },
        $setOnInsert: { mobile, purpose },
      };

      try {
        if (existingChallenge) {
          const reserved = await challengeModel.findOneAndUpdate(
            {
              _id: existingChallenge._id,
              resendAvailableAt: { $lte: now },
              consumedAt: null,
            },
            challengeUpdate,
            { new: true },
          );

          if (!reserved) {
            throw rateLimitError(RESEND_COOLDOWN_MS);
          }
        } else {
          await challengeModel.findOneAndUpdate(
            { mobile, purpose },
            challengeUpdate,
            { new: true, upsert: true, setDefaultsOnInsert: true },
          );
        }
      } catch (error) {
        if (error.code === 11000) {
          const current = await challengeModel.findOne({ mobile, purpose });
          const retryAfterMs = current?.resendAvailableAt
            ? new Date(current.resendAvailableAt).getTime() - now.getTime()
            : RESEND_COOLDOWN_MS;
          throw rateLimitError(Math.max(0, retryAfterMs));
        }
        throw error;
      }

      try {
        const delivery = await smsService.sendOtp({ mobile, otp });
        return {
          accepted: true,
          developmentOtp: delivery?.developmentOtp ?? null,
        };
      } catch (error) {
        await challengeModel.deleteOne({ mobile, purpose, codeHash });
        logger?.error('auth.otp.delivery_failed', {
          provider: 'msg91',
          errorType: error.name ?? 'Error',
        });
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError('Unable to deliver verification code', 502);
      }
    },

    async verify({ mobile, purpose, otp, ip, tokenService }) {
      await checkRateLimit('otp-verify', mobile, ip, {
        mobile: 10,
        ip: 40,
      });

      const now = clock();
      const challenge = await challengeModel
        .findOne({ mobile, purpose })
        .select('+codeHash');

      if (
        !challenge ||
        challenge.consumedAt ||
        challenge.verifiedAt ||
        new Date(challenge.expiresAt) <= now
      ) {
        throw invalidCodeError();
      }

      if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
        throw rateLimitError(OTP_LIFETIME_MS);
      }

      const submittedHash = hashOtp(otpKey, mobile, purpose, otp);

      if (!secureEqual(challenge.codeHash, submittedHash)) {
        const updated = await challengeModel.findOneAndUpdate(
          {
            _id: challenge._id,
            attempts: { $lt: OTP_MAX_ATTEMPTS },
            verifiedAt: null,
            consumedAt: null,
            expiresAt: { $gt: now },
          },
          { $inc: { attempts: 1 } },
          { new: true },
        );

        if (updated?.attempts >= OTP_MAX_ATTEMPTS) {
          throw rateLimitError(OTP_LIFETIME_MS);
        }

        throw invalidCodeError();
      }

      const verificationToken =
        purpose === 'signup' ? createToken() : null;
      const update = {
        $set: { verifiedAt: now },
      };

      if (verificationToken) {
        update.$set.verificationTokenHash = keyedHash(
          proofKey,
          verificationToken,
        );
      }

      const verified = await challengeModel.findOneAndUpdate(
        {
          _id: challenge._id,
          codeHash: submittedHash,
          attempts: { $lt: OTP_MAX_ATTEMPTS },
          verifiedAt: null,
          consumedAt: null,
          expiresAt: { $gt: now },
        },
        update,
        { new: true },
      );

      if (!verified) {
        throw invalidCodeError();
      }

      if (purpose === 'signup') {
        return {
          verified: true,
          verificationToken,
        };
      }

      const user = await userModel.findOne({
        mobile,
        role: { $in: ['customer', 'admin'] },
        isActive: true,
        mobileVerifiedAt: { $ne: null },
      });

      if (!user) {
        throw invalidCodeError();
      }

      return {
        verified: true,
        ...(await tokenService.createSession(user)),
      };
    },

    async consumeSignupVerification({ mobile, verificationToken }) {
      const now = clock();
      const challenge = await challengeModel.findOneAndUpdate(
        {
          mobile,
          purpose: 'signup',
          verifiedAt: { $ne: null },
          consumedAt: null,
          expiresAt: { $gt: now },
          verificationTokenHash: keyedHash(proofKey, verificationToken),
        },
        { $set: { consumedAt: now } },
        { new: true },
      );

      if (!challenge) {
        throw invalidCodeError();
      }

      return true;
    },
  };
}

export const otpPolicy = Object.freeze({
  expiryMs: OTP_LIFETIME_MS,
  resendCooldownMs: RESEND_COOLDOWN_MS,
  maxAttempts: OTP_MAX_ATTEMPTS,
  rateWindowMs: RATE_WINDOW_MS,
});
