import { getEnvironmentConfig } from '../../../config/env.js';
import AuthRateLimit from '../models/auth-rate-limit.model.js';
import AuthSession from '../models/auth-session.model.js';
import OtpChallenge from '../models/otp-challenge.model.js';
import User from '../../users/models/user.model.js';
import { createSmsService } from '../../../integrations/sms/sms.service.js';
import { logger } from '../../../utils/logger.js';
import { deriveKey } from '../../../utils/identity-crypto.js';
import { createOtpService } from './otp.service.js';
import { createAdminPasswordAuthService } from './admin-password-auth.service.js';
import { createRateLimitService } from './rate-limit.service.js';
import { createSessionService } from './session.service.js';
import { createIdentityAccountService } from './identity-account.service.js';
import { createProfileService } from '../../users/services/profile.service.js';

let runtime;

export function getIdentityRuntime() {
  if (runtime) {
    return runtime;
  }

  const environment = getEnvironmentConfig();
  const secret = environment.AUTH_SECRET;
  const sessionService = createSessionService({
    sessionModel: AuthSession,
    userModel: User,
    authSecret: secret,
  });
  const rateLimitService = createRateLimitService({ model: AuthRateLimit });
  const otpService = createOtpService({
    challengeModel: OtpChallenge,
    userModel: User,
    rateLimitService,
    smsService: createSmsService(environment),
    otpKey: deriveKey(secret, 'customer-otp-hash-v1'),
    rateKey: deriveKey(secret, 'customer-rate-limit-v1'),
    proofKey: deriveKey(secret, 'customer-signup-proof-v1'),
    logger,
  });
  const adminPasswordAuthService = createAdminPasswordAuthService({
    userModel: User,
    rateLimitService,
    rateKey: deriveKey(secret, 'admin-password-rate-limit-v1'),
    sessionService,
  });

  runtime = {
    otpService,
    adminPasswordAuthService,
    accountService: createIdentityAccountService({
      userModel: User,
      otpService,
    }),
    sessionService,
    profileService: createProfileService({ userModel: User }),
    userModel: User,
    challengeModel: OtpChallenge,
  };

  return runtime;
}

export function resetIdentityRuntimeForTests() {
  runtime = undefined;
}
