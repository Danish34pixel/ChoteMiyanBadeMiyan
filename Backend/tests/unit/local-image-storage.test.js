import assert from 'node:assert/strict';
import { unlink } from 'node:fs/promises';
import test from 'node:test';
import {
  localImageStorageDirectory,
  saveLocalImage,
} from '../../src/integrations/image-storage/local-image-storage.js';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=',
  'base64',
);

test('local image storage uses generated names and stores verified raster files', async () => {
  const stored = await saveLocalImage(onePixelPng, 'image/png');
  try {
    assert.match(stored.filename, /^[0-9a-f-]{36}\.png$/i);
    assert.equal(stored.url, `/uploads/${stored.filename}`);
    assert.equal(stored.filename.includes('..'), false);
  } finally {
    await unlink(new URL(`file:///${localImageStorageDirectory.replaceAll('\\', '/')}/${stored.filename}`));
  }
});

test('local image storage rejects spoofed and executable files and enforces size', async () => {
  await assert.rejects(
    saveLocalImage(Buffer.from('MZ executable'), 'image/png'),
    (error) => error.statusCode === 400,
  );
  await assert.rejects(
    saveLocalImage(onePixelPng, 'image/svg+xml'),
    (error) => error.statusCode === 400,
  );
  await assert.rejects(
    saveLocalImage(Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png'),
    (error) => error.statusCode === 413,
  );
});
