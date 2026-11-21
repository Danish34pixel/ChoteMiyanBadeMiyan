import 'dotenv/config';
import { z } from 'zod';

const mongoUriSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => /^mongodb(?:\+srv)?:\/\//i.test(value));

const corsOriginsSchema = z
  .string()
  .transform((value) => value.split(',').map((origin) => origin.trim()))
  .pipe(
    z
      .array(
        z
          .string()
          .min(1)
          .url()
          .refine(isOrigin),
      )
      .min(1)
      .refine((origins) => new Set(origins).size === origins.length),
  );

const optionalNonEmptyString = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);

function isOrigin(origin) {
  try {
    const parsedOrigin = new URL(origin);
    return (
      ['http:', 'https:'].includes(parsedOrigin.protocol) &&
      parsedOrigin.origin === origin
    );
  } catch {
    return false;
  }
}

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
    MONGODB_URI: mongoUriSchema,
    MONGODB_TEST_URI: mongoUriSchema.optional(),
    CORS_ORIGINS: corsOriginsSchema.optional(),
    AUTH_SECRET: z.string().trim().min(32),
    OTP_DEV_MODE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    LOCAL_IMAGE_UPLOADS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    CLOUDINARY_CLOUD_NAME: optionalNonEmptyString,
    CLOUDINARY_API_KEY: optionalNonEmptyString,
    CLOUDINARY_API_SECRET: optionalNonEmptyString,
    SMS_PROVIDER: z.literal('msg91').default('msg91'),
    MSG91_AUTH_KEY: optionalNonEmptyString,
    MSG91_FLOW_TEMPLATE_ID: optionalNonEmptyString,
    MSG91_OTP_VARIABLE: z.preprocess(
      (value) =>
        typeof value === 'string' && value.trim() === '' ? undefined : value,
      z
        .string()
        .regex(/^[A-Za-z][A-Za-z0-9_]{0,29}$/)
        .optional(),
    ),
  })
  .superRefine((environment, context) => {
    const cloudinaryVariables = [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ];
    const configuredCloudinaryVariables = cloudinaryVariables.filter(
      (variable) => environment[variable],
    );
    if (
      configuredCloudinaryVariables.length > 0 &&
      configuredCloudinaryVariables.length !== cloudinaryVariables.length
    ) {
      for (const variable of cloudinaryVariables) {
        if (!environment[variable]) {
          context.addIssue({
            code: 'custom',
            path: [variable],
            message: 'Configure all Cloudinary credentials together',
          });
        }
      }
    }

    if (environment.NODE_ENV === 'production' && !environment.CORS_ORIGINS) {
      context.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'Configure at least one production origin',
      });
    }

    if (environment.NODE_ENV === 'production' && environment.OTP_DEV_MODE) {
      context.addIssue({
        code: 'custom',
        path: ['OTP_DEV_MODE'],
        message: 'Development OTP mode is forbidden in production',
      });
    }

    if (environment.NODE_ENV === 'production' && environment.LOCAL_IMAGE_UPLOADS) {
      context.addIssue({
        code: 'custom',
        path: ['LOCAL_IMAGE_UPLOADS'],
        message: 'Local image uploads are forbidden in production',
      });
    }

    if (!environment.OTP_DEV_MODE) {
      for (const variable of [
        'MSG91_AUTH_KEY',
        'MSG91_FLOW_TEMPLATE_ID',
        'MSG91_OTP_VARIABLE',
      ]) {
        if (!environment[variable]) {
          context.addIssue({
            code: 'custom',
            path: [variable],
            message: 'Required when development OTP mode is disabled',
          });
        }
      }
    }
  });

const developmentOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function validateEnvironment(environment = process.env) {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    const invalidNames = [
      ...new Set(
        result.error.issues.map((issue) => issue.path[0] ?? 'environment'),
      ),
    ];
    const error = new Error(
      `Invalid environment configuration: ${invalidNames.join(', ')}`,
    );
    error.name = 'EnvironmentConfigurationError';
    throw error;
  }

  return result.data;
}

export function getEnvironmentConfig() {
  return validateEnvironment(process.env);
}

export function getAllowedOrigins(environment = process.env) {
  const rawOrigins = environment.CORS_ORIGINS;

  if (rawOrigins === undefined || rawOrigins === '') {
    return environment.NODE_ENV === 'production' ? [] : developmentOrigins;
  }

  const result = corsOriginsSchema.safeParse(rawOrigins);

  if (!result.success) {
    throw new Error('Invalid environment configuration: CORS_ORIGINS');
  }

  return result.data;
}

export function getRequiredEnvironmentVariable(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`The ${name} environment variable is required`);
  }

  return value;
}
