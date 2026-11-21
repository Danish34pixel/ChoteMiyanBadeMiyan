import { AppError } from '../../../utils/app-error.js';
import { getIdentityRuntime } from '../services/identity-runtime.js';

export function createRoleAuth(
  requiredRole,
  getSessionService = () => getIdentityRuntime().sessionService,
) {
  return async function roleAuth(req, _res, next) {
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
      await getSessionService().authenticateAccessToken(token);

    if (user.role !== requiredRole) {
      throw new AppError('Insufficient permissions', 403);
    }

    req.auth = {
      userId: String(user._id ?? user.id),
      sessionId,
      role: user.role,
    };
    next();
  };
}
