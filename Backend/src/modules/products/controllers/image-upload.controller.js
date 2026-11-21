import { getEnvironmentConfig } from '../../../config/env.js';
import { AppError } from '../../../utils/app-error.js';
import { saveLocalImage } from '../../../integrations/image-storage/local-image-storage.js';
import { saveCloudinaryImage } from '../../../integrations/image-storage/cloudinary-image-storage.js';

export async function uploadProductImage(req, res) {
  const config = getEnvironmentConfig();
  if (!config.CLOUDINARY_CLOUD_NAME && !config.LOCAL_IMAGE_UPLOADS) {
    throw new AppError(
      'Image uploads are not configured; use a hosted HTTPS image URL',
      503,
    );
  }

  const image = config.LOCAL_IMAGE_UPLOADS
    ? await saveLocalImage(req.body, req.get('content-type'))
    : await saveCloudinaryImage(req.body, req.get('content-type'), { config });
  res.status(201).json({
    success: true,
    message: 'Image stored successfully',
    data: image,
  });
}
