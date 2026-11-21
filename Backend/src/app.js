import express from 'express';
import authRoutes from './modules/auth/routes/auth.routes.js';
import healthRoutes from './modules/health/routes/health.routes.js';
import customerRoutes from './modules/users/routes/customer.routes.js';
import categoryRoutes from './modules/categories/routes/category.routes.js';
import adminCategoryRoutes from './modules/categories/routes/admin-category.routes.js';
import productRoutes from './modules/products/routes/product.routes.js';
import adminProductRoutes from './modules/products/routes/admin-product.routes.js';
import adminInventoryRoutes from './modules/inventory/routes/admin-inventory.routes.js';
import adminImageUploadRoutes from './modules/products/routes/admin-image-upload.routes.js';
import { getEnvironmentConfig } from './config/env.js';
import { localImageStorageDirectory } from './integrations/image-storage/local-image-storage.js';
import { errorHandler } from './middlewares/error-handler.js';
import { notFoundHandler } from './middlewares/not-found-handler.js';
import { requestId } from './middlewares/request-id.js';
import { requestLogger } from './middlewares/request-logger.js';
import { corsMiddleware, securityHeaders } from './middlewares/security.js';

const app = express();

app.disable('x-powered-by');
app.use(requestId);
app.use(securityHeaders);
app.use(requestLogger);
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use('/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/customer', customerRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/admin/categories', adminCategoryRoutes);
app.use('/api/v1/admin/products', adminProductRoutes);
app.use('/api/v1/admin/inventory', adminInventoryRoutes);
app.use('/api/v1/admin/uploads', adminImageUploadRoutes);
if (getEnvironmentConfig().LOCAL_IMAGE_UPLOADS) {
  app.use(
    '/uploads',
    express.static(localImageStorageDirectory, {
      dotfiles: 'deny',
      index: false,
      fallthrough: false,
      immutable: true,
      maxAge: '1y',
    }),
  );
}
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
