import assert from 'node:assert/strict';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { uploadProductImage } from '../../src/modules/products/controllers/image-upload.controller.js';
import { localImageStorageDirectory } from '../../src/integrations/image-storage/local-image-storage.js';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=',
  'base64',
);

test('local development uploads use disk storage even when Cloudinary is configured', async () => {
  const environment = {
    NODE_ENV: 'development',
    MONGODB_URI: 'mongodb://localhost/test-db',
    AUTH_SECRET: 'local-upload-test-secret-with-at-least-32-characters',
    OTP_DEV_MODE: 'true',
    LOCAL_IMAGE_UPLOADS: 'true',
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-api-key',
    CLOUDINARY_API_SECRET: 'test-api-secret',
  };
  const originalEnvironment = new Map(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  );
  const originalFetch = globalThis.fetch;
  let uploadedFilename;

  for (const [key, value] of Object.entries(environment)) {
    process.env[key] = value;
  }
  globalThis.fetch = async () => {
    throw new Error('Cloudinary should not be called for local uploads');
  };

  try {
    const response = {
      statusCode: undefined,
      body: undefined,
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    await uploadProductImage(
      { body: onePixelPng, get: () => 'image/png' },
      response,
    );

    uploadedFilename = response.body.data.filename;
    assert.equal(response.statusCode, 201);
    assert.match(response.body.data.url, /^\/uploads\/[a-f\d-]+\.png$/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of originalEnvironment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (uploadedFilename) {
      await unlink(resolve(localImageStorageDirectory, uploadedFilename));
    }
  }
});
