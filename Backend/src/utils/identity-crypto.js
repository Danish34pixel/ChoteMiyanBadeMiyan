import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

export function deriveKey(secret, purpose) {
  return createHmac('sha256', secret).update(purpose).digest();
}

export function keyedHash(key, value) {
  return createHmac('sha256', key).update(value).digest('hex');
}

export function secureEqual(first, second) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  );
}

export function generateOtp() {
  return randomInt(100000, 1000000).toString();
}

export function generateOpaqueToken() {
  return randomBytes(32).toString('base64url');
}

export function hashOtp(otpKey, mobile, purpose, otp) {
  return keyedHash(otpKey, `${mobile}:${purpose}:${otp}`);
}

export function hashRefreshToken(refreshKey, token) {
  return keyedHash(refreshKey, token);
}
