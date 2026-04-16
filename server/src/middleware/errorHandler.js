/**
 * middleware/errorHandler.js — global error handler
 */

'use strict';

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const status = err.status || err.statusCode || 500;
  
  // Log full error details for debugging
  console.error('[ERROR]', {
    message: err.message || 'Unknown error',
    status,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: err.stack }),
  });
  
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
