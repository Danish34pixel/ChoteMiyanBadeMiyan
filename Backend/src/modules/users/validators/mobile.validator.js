import { z } from 'zod';

export function normalizeMobileNumber(value) {
  if (typeof value !== 'string') {
    return null;
  }

  let normalized = value.trim().replace(/[\s().-]/g, '');

  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`;
  } else if (/^[6-9]\d{9}$/.test(normalized)) {
    normalized = `+91${normalized}`;
  } else if (/^91[6-9]\d{9}$/.test(normalized)) {
    normalized = `+${normalized}`;
  } else if (/^[1-9]\d{7,14}$/.test(normalized)) {
    normalized = `+${normalized}`;
  }

  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

export const mobileNumberSchema = z
  .string()
  .trim()
  .transform(normalizeMobileNumber)
  .pipe(
    z
      .string()
      .regex(/^\+[1-9]\d{7,14}$/, 'A valid mobile number is required'),
  );
