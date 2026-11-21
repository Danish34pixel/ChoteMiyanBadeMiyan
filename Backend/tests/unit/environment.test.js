import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAllowedOrigins,
  validateEnvironment,
} from '../../src/config/env.js';

const validEnvironment = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/shop',
  AUTH_SECRET: 'test-secret-with-at-least-thirty-two-characters',
  OTP_DEV_MODE: 'true',
};

test('environment validation applies safe defaults and validates the Mongo URI', () => {
  const config = validateEnvironment(validEnvironment);

  assert.equal(config.NODE_ENV, 'development');
  assert.equal(config.PORT, 3000);
  assert.equal(config.TRUST_PROXY_HOPS, 0);
  assert.equal(config.MONGODB_URI, validEnvironment.MONGODB_URI);
  assert.equal(config.MONGODB_TEST_URI, undefined);
});

test('environment validation reports invalid variable names without values', () => {
  const secret = 'do-not-print-this-value';

  assert.throws(
    () =>
      validateEnvironment({
        ...validEnvironment,
        MONGODB_URI: `not-a-mongodb-uri-${secret}`,
        PORT: '70000',
      }),
    (error) => {
      assert.equal(error.name, 'EnvironmentConfigurationError');
      assert.match(error.message, /MONGODB_URI/);
      assert.match(error.message, /PORT/);
      assert.equal(error.message.includes(secret), false);
      return true;
    },
  );
});

test('production requires explicit exact HTTP(S) CORS origins', () => {
  assert.throws(
    () =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        OTP_DEV_MODE: 'false',
        MSG91_AUTH_KEY: 'test-auth-key',
        MSG91_FLOW_TEMPLATE_ID: 'test-template',
        MSG91_OTP_VARIABLE: 'VAR1',
      }),
    /CORS_ORIGINS/,
  );

  const config = validateEnvironment({
    ...validEnvironment,
    NODE_ENV: 'production',
    OTP_DEV_MODE: 'false',
    MSG91_AUTH_KEY: 'test-auth-key',
    MSG91_FLOW_TEMPLATE_ID: 'test-template',
    MSG91_OTP_VARIABLE: 'VAR1',
    CORS_ORIGINS: 'https://shop.example.com,https://admin.example.com',
  });

  assert.deepEqual(config.CORS_ORIGINS, [
    'https://shop.example.com',
    'https://admin.example.com',
  ]);
});

test('CORS configuration rejects wildcard, path, duplicate, and non-HTTP origins', () => {
  for (const CORS_ORIGINS of [
    '*',
    'https://shop.example.com/store',
    'https://shop.example.com,https://shop.example.com',
    'file://shop.example.com',
  ]) {
    assert.throws(
      () =>
        validateEnvironment({
          ...validEnvironment,
          CORS_ORIGINS,
        }),
      /CORS_ORIGINS/,
    );
  }
});

test('development OTP mode is explicit and forbidden in production', () => {
  const development = validateEnvironment({
    ...validEnvironment,
    MSG91_AUTH_KEY: '',
    MSG91_FLOW_TEMPLATE_ID: '',
    MSG91_OTP_VARIABLE: '',
  });
  assert.equal(development.OTP_DEV_MODE, true);

  assert.throws(
    () =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://shop.example.com',
      }),
    /OTP_DEV_MODE/,
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...validEnvironment,
        AUTH_SECRET: 'short',
      }),
    /AUTH_SECRET/,
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...validEnvironment,
        OTP_DEV_MODE: 'false',
      }),
    /MSG91_AUTH_KEY/,
  );
});

test('local image uploads default off and are forbidden in production', () => {
  assert.equal(validateEnvironment(validEnvironment).LOCAL_IMAGE_UPLOADS, false);
  assert.throws(
    () =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        OTP_DEV_MODE: 'false',
        MSG91_AUTH_KEY: 'test-auth-key',
        MSG91_FLOW_TEMPLATE_ID: 'test-template',
        MSG91_OTP_VARIABLE: 'VAR1',
        CORS_ORIGINS: 'https://shop.example.com',
        LOCAL_IMAGE_UPLOADS: 'true',
      }),
    /LOCAL_IMAGE_UPLOADS/,
  );
});

test('Cloudinary credentials must be configured as a complete set', () => {
  const cloudinary = {
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-api-key',
    CLOUDINARY_API_SECRET: 'test-api-secret',
  };
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(validateEnvironment({ ...validEnvironment, ...cloudinary }))
        .filter(([key]) => key.startsWith('CLOUDINARY_')),
    ),
    cloudinary,
  );
  assert.throws(
    () =>
      validateEnvironment({
        ...validEnvironment,
        CLOUDINARY_CLOUD_NAME: 'test-cloud',
      }),
    /CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET/,
  );
});

test('development CORS defaults are limited to local frontend origins', () => {
  assert.deepEqual(getAllowedOrigins({ NODE_ENV: 'development' }), [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);
  assert.deepEqual(getAllowedOrigins({ NODE_ENV: 'production' }), []);
});
