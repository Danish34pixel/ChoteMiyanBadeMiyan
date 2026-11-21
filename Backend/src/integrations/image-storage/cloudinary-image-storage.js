import { createHash, randomUUID } from 'node:crypto';
import { getEnvironmentConfig } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';
import { validateImage } from './local-image-storage.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_FOLDER = 'chote-miyan-bade-miya';

function signatureFor(parameters, apiSecret) {
  const signedValues = Object.keys(parameters)
    .sort()
    .map((key) => `${key}=${parameters[key]}`)
    .join('&');
  return createHash('sha1')
    .update(`${signedValues}${apiSecret}`)
    .digest('hex');
}

function safeProviderMessage(message, config) {
  if (typeof message !== 'string') return '';
  let safeMessage = message.replace(/[\r\n\t]+/g, ' ').trim();
  for (const secret of [
    config.CLOUDINARY_API_KEY,
    config.CLOUDINARY_API_SECRET,
  ]) {
    if (secret) safeMessage = safeMessage.split(secret).join('[redacted]');
  }
  return safeMessage.slice(0, 200);
}

export async function saveCloudinaryImage(
  buffer,
  contentType,
  { fetchImplementation = fetch, now = Date.now, config = getEnvironmentConfig() } = {},
) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError('An image file is required', 400);
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new AppError('Image must be 5 MB or smaller', 413);
  }

  const extension = validateImage(buffer, contentType);
  const timestamp = Math.floor(now() / 1000);
  const publicId = randomUUID();
  const parameters = {
    folder: IMAGE_FOLDER,
    public_id: publicId,
    timestamp: String(timestamp),
  };
  const signature = signatureFor(parameters, config.CLOUDINARY_API_SECRET);
  const form = new FormData();
  form.set('api_key', config.CLOUDINARY_API_KEY);
  form.set('folder', IMAGE_FOLDER);
  form.set('public_id', publicId);
  form.set('timestamp', String(timestamp));
  form.set('signature', signature);
  form.set(
    'file',
    new Blob([buffer], { type: contentType }),
    `${publicId}.${extension}`,
  );

  let response;
  try {
    response = await fetchImplementation(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.CLOUDINARY_CLOUD_NAME)}/image/upload`,
      { method: 'POST', body: form },
    );
  } catch {
    throw new AppError('Image storage service could not be reached', 502);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new AppError('Image storage service returned an invalid response', 502);
  }
  let secureUrl;
  try {
    secureUrl = new URL(
      result && typeof result.secure_url === 'string' ? result.secure_url : '',
    );
  } catch {
    secureUrl = null;
  }
  if (
    !response.ok ||
    !result ||
    secureUrl?.protocol !== 'https:' ||
    !result.public_id
  ) {
    const providerMessage = safeProviderMessage(result?.error?.message, config);
    const message =
      config.NODE_ENV === 'development' && providerMessage
        ? `Image storage service rejected the upload: ${providerMessage}`
        : 'Image storage service rejected the upload';
    throw new AppError(message, 502);
  }

  return {
    filename: publicId,
    publicId: result.public_id,
    url: secureUrl.href,
  };
}
