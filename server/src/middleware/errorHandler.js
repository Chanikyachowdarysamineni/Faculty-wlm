'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * middleware/errorHandler.js — Centralized, Secure & User-Friendly Global Error Handler
 */

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const status = Number(err.status || err.statusCode) || 500;
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID().slice(0, 8);

  // Securely log complete diagnostic info with correlation ID for developers
  logger.error('[API Error]', {
    correlationId,
    name: err.name,
    code: err.code,
    message: err.message || 'Unknown error',
    status,
    path: req.originalUrl || req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id || req.user?.empId || 'anonymous',
    timestamp: new Date().toISOString(),
    stack: err.stack,
  });

  // 1. Mongoose validation error
  if (err.name === 'ValidationError') {
    const errorDetails = err.errors
      ? Object.entries(err.errors).map(([field, val]) => ({
          field,
          message: val.message || `Invalid value for ${field}.`
        }))
      : [];
    const messages = errorDetails.map(e => e.message);

    return res.status(400).json({
      success: false,
      message: 'Please review and correct the invalid form fields.',
      errors: errorDetails.length > 0 ? errorDetails : messages,
      correlationId
    });
  }

  // 2. Mongoose / MongoDB duplicate key error (code 11000 / 11001)
  if (err.code === 11000 || err.code === 11001) {
    let duplicateField = 'record';
    if (err.keyPattern) {
      const keys = Object.keys(err.keyPattern);
      duplicateField = keys.join(', ');
    }
    return res.status(409).json({
      success: false,
      message: `A record with this ${duplicateField} already exists. Please verify your information.`,
      correlationId
    });
  }

  // 3. MongoDB Transaction WriteConflict or transient transaction retry error
  if (err.code === 112 || err.errorLabels?.includes('TransientTransactionError')) {
    return res.status(409).json({
      success: false,
      message: 'This record was modified by another operation at the same time. Please refresh and try again.',
      correlationId
    });
  }

  // 4. Mongoose CastError (invalid ObjectId or numeric identifier)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'The requested record identifier or parameter format is invalid.',
      correlationId
    });
  }

  // 5. JWT Authentication errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Your authentication session is invalid. Please log in again.',
      correlationId
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Your session has expired. Please log in again to continue.',
      correlationId
    });
  }

  // 6. Payload Too Large (e.g., file import or large JSON)
  if (err.type === 'entity.too.large' || status === 413) {
    return res.status(413).json({
      success: false,
      message: 'The submitted file or request payload exceeds the maximum allowed size.',
      correlationId
    });
  }

  // 7. Generic / 500 errors
  let message = err.message || 'An error occurred';
  if (status >= 500) {
    message = `An unexpected error occurred while processing your request. Please try again or contact the administrator (Reference: ${correlationId}).`;
  }

  res.status(status).json({
    success: false,
    message,
    correlationId,
    timestamp: new Date().toISOString(),
  });
};

module.exports = errorHandler;
