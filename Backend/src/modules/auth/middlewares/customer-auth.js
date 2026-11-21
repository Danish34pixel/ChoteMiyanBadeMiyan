import { AppError } from '../../../utils/app-error.js';
import { getIdentityRuntime } from '../services/identity-runtime.js';

export async function customerAuth(req, _res, next) {
  const authorization = req.get('authorization');
  const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? '');

  if (!match) {
    throw new AppError('Authentication required', 401);
  }

  const { user, sessionId } =
    await getIdentityRuntime().sessionService.authenticateAccessToken(
      match[1],
    );

  if (user.role !== 'customer') {
    throw new AppError('Insufficient permissions', 403);
  }

  req.auth = {
    userId: String(user._id ?? user.id),
    sessionId,
    role: 'customer',
  };
  next();
}
