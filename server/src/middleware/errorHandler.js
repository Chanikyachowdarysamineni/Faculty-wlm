const logger = require('../utils/logger');
/**
 * middleware/errorHandler.js — global error handler
 */

'use strict';

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const status = err.status || err.statusCode || 500;
  
  // Log full error details for debugging
  logger.error('[ERROR]', {
    message: err.message || 'Unknown error',
    status,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: err.stack }),
  });
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({ success: false, message: 'Validation Error', errors: messages });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Duplicate Key Error. A record with this unique identifier already exists.' });
  }

  // CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid ${err.path}: ${err.value}` });
  }

  // Determine error message to send to client
  let message = err.message || 'An error occurred';
  
  // Hide sensitive details from clients in production
  if (!isDevelopment && status >= 500) {
    message = 'An unexpected error occurred. Please try again later.';
  }
  
  // Build error response
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };
  
  // Include stack trace only in development
  if (isDevelopment && err.stack) {
    response.stack = err.stack;
  }
  
  res.status(status).json(response);
};

module.exports = errorHandler;
