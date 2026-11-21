import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { AppError } from '../../utils/app-error.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const storageDirectory = resolve(
  fileURLToPath(new URL('../../storage/local-images/', import.meta.url)),
);

function validPng(buffer) {
  if (
    buffer.length < 45 ||
    !buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return false;
  }
  let offset = 8;
  let hasHeader = false;
  let hasImageData = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + length + 12;
    if (end > buffer.length) return false;
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (!hasHeader) {
      if (type !== 'IHDR' || length !== 13) return false;
      const width = buffer.readUInt32BE(offset + 8);
      const height = buffer.readUInt32BE(offset + 12);
      if (!width || !height || width > 20000 || height > 20000) return false;
      hasHeader = true;
    }
    if (type === 'IDAT') hasImageData = true;
    if (type === 'IEND') {
      return length === 0 && hasHeader && hasImageData && end === buffer.length;
    }
    offset = end;
  }
  return false;
}

function validJpeg(buffer) {
  if (
    buffer.length < 16 ||
    buffer[0] !== 0xff ||
    buffer[1] !== 0xd8 ||
    buffer.at(-2) !== 0xff ||
    buffer.at(-1) !== 0xd9
  ) {
    return false;
  }
  let offset = 2;
  let hasFrame = false;
  while (offset < buffer.length - 2) {
    if (buffer[offset] !== 0xff) return false;
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xda) {
      if (offset + 2 > buffer.length) return false;
      const scanLength = buffer.readUInt16BE(offset);
      return (
        hasFrame &&
        scanLength >= 6 &&
        offset + scanLength < buffer.length - 2
      );
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 2 > buffer.length) return false;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return false;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 8) return false;
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (!width || !height) return false;
      hasFrame = true;
    }
    offset += length;
  }
  return false;
}

function validWebp(buffer) {
  if (
    buffer.length < 20 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.readUInt32LE(4) + 8 !== buffer.length ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return false;
  }
  let offset = 12;
  let hasImageChunk = false;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + size;
    if (end > buffer.length) return false;
    if (['VP8 ', 'VP8L', 'VP8X'].includes(type)) hasImageChunk = true;
    offset = end + (size % 2);
  }
  return hasImageChunk && offset === buffer.length;
}

export function validateImage(buffer, contentType) {
  if (contentType === 'image/png' && validPng(buffer)) {
    return 'png';
  }
  if (contentType === 'image/jpeg' && validJpeg(buffer)) {
    return 'jpg';
  }
  if (contentType === 'image/webp' && validWebp(buffer)) {
    return 'webp';
  }
  throw new AppError('Only valid PNG, JPEG, or WebP images are accepted', 400);
}

export async function saveLocalImage(buffer, contentType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError('An image file is required', 400);
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new AppError('Image must be 5 MB or smaller', 413);
  }

  const extension = validateImage(buffer, contentType);
  const filename = `${randomUUID()}.${extension}`;
  await mkdir(storageDirectory, { recursive: true });
  await writeFile(resolve(storageDirectory, filename), buffer, { flag: 'wx' });
  return { filename, url: `/uploads/${filename}` };
}

export const localImageStorageDirectory = storageDirectory;
