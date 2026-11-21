import { AppError } from '../../../utils/app-error.js';
import { getIdentityRuntime } from '../services/identity-runtime.js';

export async function accessAuth(req, _res, next) {
  const authorization = req.get('authorization') ?? '';
  const [scheme, token, ...extra] = authorization.trim().split(/\s+/);

  if (
    scheme?.toLowerCase() !== 'bearer' ||
    !token ||
    extra.length > 0
  ) {
    throw new AppError('Authentication required', 401);
  }

  const { user, sessionId } =
    await getIdentityRuntime().sessionService.authenticateAccessToken(token);
  req.auth = {
    userId: String(user._id ?? user.id),
    sessionId,
    role: user.role,
  };
  next();
}
