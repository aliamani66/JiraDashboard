const logger = require('../utils/logger');

/**
 * Centralized Global Error Handler Middleware
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  const errorDetails = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection?.remoteAddress,
    user: req.user ? { id: req.user.id, username: req.user.username } : 'anonymous',
    status: statusCode,
    message: err.message || 'خطای داخلی سرور'
  };

  logger.error(`[HTTP_ERROR] ${req.method} ${req.originalUrl} - ${statusCode} - ${err.message}`, err);

  res.status(statusCode).json({
    success: false,
    error: err.message || 'خطای پردازش در سرور رخ داده است',
    code: err.code || 'INTERNAL_SERVER_ERROR',
    status: statusCode,
    timestamp: new Date().toISOString(),
    ...(isProd ? {} : { stack: err.stack, details: errorDetails })
  });
}

/**
 * Request logger middleware (logs incoming HTTP requests)
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/api') && !req.originalUrl.includes('/jira/logs')) {
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';
      logger[level](`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
}

module.exports = {
  errorHandler,
  requestLogger
};
