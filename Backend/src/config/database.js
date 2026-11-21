import mongoose from 'mongoose';
import { getEnvironmentConfig } from './env.js';
import { logger } from '../utils/logger.js';

mongoose.connection.on('error', (error) => {
  logger.error('database.connection.error', {
    errorType: error.name,
  });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('database.connection.disconnected');
});

export async function connectDatabase(uri = getEnvironmentConfig().MONGODB_URI) {
  try {
    await mongoose.connect(uri);
    logger.info('database.connection.connected');
  } catch (error) {
    logger.error('database.connection.failed', {
      errorType: error.name,
    });
    throw error;
  }
}

export async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    logger.info('database.connection.closed');
  } catch (error) {
    logger.error('database.disconnection.failed', {
      errorType: error.name,
    });
    throw error;
  }
}
