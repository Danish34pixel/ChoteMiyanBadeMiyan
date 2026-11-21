import { AppError } from '../../../utils/app-error.js';
import { keyedHash } from '../../../utils/identity-crypto.js';
import { hashPassword, verifyPassword } from '../../../utils/password.js';

const LOGIN_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function rateLimitError(retryAfterMs) {
  const error = new AppError('Too many login attempts; try again later', 429);
  error.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return error;
}

function invalidCredentialsError() {
  return new AppError('Invalid email or password', 401);
}

export function createAdminPasswordAuthService({
  userModel,
  rateLimitService,
  rateKey,
  sessionService,
}) {
  async function checkRateLimit(scope, identifier) {
    const result = await rateLimitService.consume({
      bucketKey: keyedHash(rateKey, `admin-password-login:${scope}:${identifier}`),
      limit: LOGIN_LIMIT,
      windowMs: RATE_WINDOW_MS,
    });
    if (!result.allowed) throw rateLimitError(result.retryAfterMs);
  }

  return {
    async login({ email: inputEmail, password, ip }) {
      const email = inputEmail.trim().toLowerCase();
      await checkRateLimit('email', email);
      await checkRateLimit('ip', ip);

      const user = await userModel
        .findOne({ email, role: 'admin', isActive: true })
        .select('+password');

      if (!user) {
        await hashPassword(password);
        throw invalidCredentialsError();
      }

      if (!(await verifyPassword(password, user.password))) {
        throw invalidCredentialsError();
      }

      return {
        user,
        ...(await sessionService.createSession(user)),
      };
    },
  };
}
