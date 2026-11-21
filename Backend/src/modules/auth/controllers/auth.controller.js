import {
  authenticateCustomer,
  registerCustomer,
  toPublicCustomer,
} from '../services/auth.service.js';
import { getIdentityRuntime } from '../services/identity-runtime.js';

export async function signup(req, res) {
  const user = await registerCustomer(req.body);

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: { user },
  });
}

export async function authenticateUserLogin(
  { email: inputEmail, password, ip },
  runtime = getIdentityRuntime(),
) {
  const email = inputEmail.trim().toLowerCase();
  const account = await runtime.userModel.findOne({ email }).select('role');

  if (account?.role === 'admin') {
    return runtime.adminPasswordAuthService.login({
      email,
      password,
      ip,
    });
  }

  const user = await authenticateCustomer({ email, password });
  return {
    user,
    ...(await runtime.sessionService.createSession(user)),
  };
}

export async function login(req, res) {
  const result = await authenticateUserLogin({
    ...req.body,
    ip: req.ip,
  });
  const { user, ...tokens } = result;

  res.status(200).json({
    success: true,
    message: 'Authentication successful',
    data: {
      user: toPublicCustomer(user),
      ...tokens,
    },
  });
}

export async function adminLogin(req, res) {
  const result = await getIdentityRuntime().adminPasswordAuthService.login({
    ...req.body,
    ip: req.ip,
  });

  res.status(200).json({
    success: true,
    message: 'Authentication successful',
    data: {
      user: toPublicCustomer(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    },
  });
}
