import mongoose from 'mongoose';

export function liveness(_req, res) {
  res.status(200).json({
    success: true,
    data: { status: 'alive' },
  });
}

export function readiness(_req, res) {
  const databaseConnected = mongoose.connection.readyState === 1;

  if (!databaseConnected) {
    res.status(503).json({
      success: false,
      message: 'Service is not ready',
      data: {
        status: 'not_ready',
        dependencies: { database: 'disconnected' },
      },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      status: 'ready',
      dependencies: { database: 'connected' },
    },
  });
}
