import { configureDns } from './config/dns.js';
import { getEnvironmentConfig } from './config/env.js';
import { logger } from './utils/logger.js';

let port;
let server;
let shuttingDown = false;
let app;
let connectDatabase;
let disconnectDatabase;

async function closeServer() {
  if (!server?.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info('server.shutdown.started', { signal });

  try {
    await closeServer();
  } catch (error) {
    logger.error('server.http_shutdown.failed', {
      errorType: error.name,
    });
    process.exitCode = 1;
  }

  try {
    await disconnectDatabase();
  } catch (error) {
    logger.error('server.database_shutdown.failed', {
      errorType: error.name,
    });
    process.exitCode = 1;
  }

  logger.info('server.shutdown.completed');
}

try {
  const environment = getEnvironmentConfig();
  port = environment.PORT;
  configureDns();

  ({ default: app } = await import('./app.js'));
  ({ connectDatabase, disconnectDatabase } =
    await import('./config/database.js'));

  app.set('trust proxy', environment.TRUST_PROXY_HOPS);
  await connectDatabase(environment.MONGODB_URI);

  server = await new Promise((resolve, reject) => {
    const httpServer = app.listen(port);
    httpServer.once('error', reject);
    httpServer.once('listening', () => {
      httpServer.removeListener('error', reject);
      resolve(httpServer);
    });
  });

  logger.info('server.listening', { port });
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
} catch (error) {
  const fields = {
    errorType: error.name ?? 'Error',
  };

  if (error.name === 'EnvironmentConfigurationError') {
    fields.message = error.message;
  }

  logger.error('server.startup.failed', fields);
  process.exitCode = 1;
  if (disconnectDatabase) {
    try {
      await disconnectDatabase();
    } catch (disconnectError) {
      logger.error('server.database_cleanup.failed', {
        errorType: disconnectError.name,
      });
    }
  }
}
