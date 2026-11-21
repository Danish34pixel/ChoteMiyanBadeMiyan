import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { saveCloudinaryImage } from '../../src/integrations/image-storage/cloudinary-image-storage.js';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=',
  'base64',
);
const config = {
  CLOUDINARY_CLOUD_NAME: 'test-cloud',
  CLOUDINARY_API_KEY: 'test-api-key',
  CLOUDINARY_API_SECRET: 'test-api-secret',
};

test('Cloudinary storage signs uploads and returns only confirmed HTTPS assets', async () => {
  let requestUrl;
  let requestOptions;
  const uploaded = await saveCloudinaryImage(onePixelPng, 'image/png', {
    config,
    now: () => 1_700_000_000_000,
    fetchImplementation: async (url, options) => {
      requestUrl = url;
      requestOptions = options;
      return {
        ok: true,
        json: async () => ({
          secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/example.png',
          public_id: 'chote-miyan-bade-miya/products/example',
        }),
      };
    },
  });

  assert.equal(
    requestUrl,
    'https://api.cloudinary.com/v1_1/test-cloud/image/upload',
  );
  assert.equal(requestOptions.method, 'POST');
  const body = requestOptions.body;
  assert.equal(body.get('api_key'), config.CLOUDINARY_API_KEY);
  assert.equal(body.get('folder'), 'chote-miyan-bade-miya');
  assert.equal(body.get('timestamp'), '1700000000');
  const signatureParameters = [
    `folder=${body.get('folder')}`,
    `public_id=${body.get('public_id')}`,
    `timestamp=${body.get('timestamp')}`,
  ].join('&');
  assert.equal(
    body.get('signature'),
    createHash('sha1')
      .update(`${signatureParameters}${config.CLOUDINARY_API_SECRET}`)
      .digest('hex'),
  );
  assert.equal(body.get('file').type, 'image/png');
  assert.match(uploaded.url, /^https:\/\/res\.cloudinary\.com\//);
  assert.equal(uploaded.publicId, 'chote-miyan-bade-miya/products/example');
});

test('Cloudinary storage rejects invalid files and unconfirmed provider responses', async () => {
  let requested = false;
  const fetchImplementation = async () => {
    requested = true;
    return { ok: false, json: async () => ({ error: { message: 'private details' } }) };
  };
  await assert.rejects(
    saveCloudinaryImage(Buffer.from('MZ executable'), 'image/png', {
      config,
      fetchImplementation,
    }),
    (error) => error.statusCode === 400,
  );
  assert.equal(requested, false);

  await assert.rejects(
    saveCloudinaryImage(onePixelPng, 'image/png', {
      config,
      fetchImplementation,
    }),
    (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.message.includes('private details'), false);
      return true;
    },
  );

  await assert.rejects(
    saveCloudinaryImage(onePixelPng, 'image/png', {
      config,
      fetchImplementation: async () => ({
        ok: true,
        json: async () => ({ secure_url: 'http://example.com/image.png', public_id: 'unsafe' }),
      }),
    }),
    (error) => error.statusCode === 502,
  );
});

test('development upload errors show sanitized Cloudinary diagnostics', async () => {
  await assert.rejects(
    saveCloudinaryImage(onePixelPng, 'image/png', {
      config: { ...config, NODE_ENV: 'development' },
      fetchImplementation: async () => ({
        ok: false,
        json: async () => ({
          error: {
            message: `Invalid credentials: ${config.CLOUDINARY_API_SECRET}`,
          },
        }),
      }),
    }),
    (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.message.includes(config.CLOUDINARY_API_SECRET), false);
      assert.match(error.message, /\[redacted\]/);
      return true;
    },
  );
});
