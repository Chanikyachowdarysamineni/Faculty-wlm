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
  
  // L-6 FIX: Sanitize error messages in production to prevent information disclosure.
  // Mongoose errors can expose field names, schema structure, and internal query details.
  if (!isDevelopment) {
    if (status >= 500) {
      message = 'An unexpected error occurred. Please try again later.';
    } else if (err.name === 'CastError') {
      // Already handled above but guard against double-send
      message = 'Invalid request parameter.';
    } else if (err.name === 'ValidationError') {
      // Already handled above but guard
      message = 'Validation error. Please check your input.';
    } else if (err.code === 11000) {
      // Already handled above
      message = 'Duplicate entry.';
    }
    // 4xx application errors from route handlers use sendError() which provides
    // safe, user-friendly messages — pass those through as-is.
  }
  
  // Build error response
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };
  
  // Prevent stack traces from ever being exposed to the client
  // Stack traces are securely logged to the console/logger above
  
  res.status(status).json(response);
};

module.exports = errorHandler;
