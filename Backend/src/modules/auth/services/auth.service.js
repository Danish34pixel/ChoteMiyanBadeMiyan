import User from '../../users/models/user.model.js';
import { AppError } from '../../../utils/app-error.js';
import { hashPassword, verifyPassword } from '../../../utils/password.js';

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export async function registerCustomer({ name, email, password, address }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.exists({ email: normalizedEmail });

  if (existingUser) {
    throw new AppError('An account with this email already exists', 409);
  }

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: await hashPassword(password),
    role: 'customer',
    ...(address ? { addresses: [address] } : {}),
  });

  return toPublicUser(user);
}

export async function authenticateCustomer({ email, password }) {
  const user = await User.findOne({
    email: email.trim().toLowerCase(),
    role: 'customer',
    isActive: true,
  }).select('+password');

  if (!user) {
    await hashPassword(password);
    throw new AppError('Invalid email or password', 401);
  }

  if (!(await verifyPassword(password, user.password))) {
    throw new AppError('Invalid email or password', 401);
  }

  return user;
}

export function toPublicCustomer(user) {
  return toPublicUser(user);
}
