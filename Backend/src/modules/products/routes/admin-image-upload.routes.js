import { Router } from 'express';
import express from 'express';
import { getEnvironmentConfig } from '../../../config/env.js';
import { adminAuth } from '../../auth/middlewares/admin-auth.js';
import { uploadProductImage } from '../controllers/image-upload.controller.js';

const router = Router();

router.use(adminAuth);
router.post(
  '/images',
  (req, res, next) => {
    const config = getEnvironmentConfig();
    if (!config.LOCAL_IMAGE_UPLOADS && !config.CLOUDINARY_CLOUD_NAME) {
      next();
      return;
    }
    express.raw({
      type: ['image/png', 'image/jpeg', 'image/webp'],
      limit: '5mb',
    })(req, res, next);
  },
  uploadProductImage,
);

export default router;
