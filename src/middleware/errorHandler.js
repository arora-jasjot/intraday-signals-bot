const config = require('../config');

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Default error
  let error = { ...err };
  error.message = err.message;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(error => error.message);
    error = {
      message: 'Validation Error',
      details: message,
      statusCode: 400,
    };
  }

  if (err.name === 'CastError') {
    error = {
      message: 'Resource not found',
      statusCode: 404,
    };
  }

  if (err.code === 11000) {
    error = {
      message: 'Duplicate field value entered',
      statusCode: 400,
    };
  }

  // Set default values
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(error.details && { details: error.details }),
      ...(config.server.nodeEnv === 'development' && { stack: err.stack }),
    },
    timestamp: new Date().toISOString(),
  });
};

module.exports = errorHandler;
