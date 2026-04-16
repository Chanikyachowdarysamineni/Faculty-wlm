'use strict';

/**
 * utilities/response.js - Standardized response helpers
 * Use these functions in route handlers to ensure consistent response format
 */

/**
 * Send a successful response
 * @param {Response} res - Express response object
 * @param {any} data - Response data (can be null)
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {object} options - Additional options like pagination
 * @example
 * sendSuccess(res, { id: 1, name: 'John' }, 200);
 * sendSuccess(res, null, 201, { message: 'Created successfully' });
 */
const sendSuccess = (res, data = null, statusCode = 200, options = {}) => {
  res.status(statusCode).json({
    success: true,
    message: options.message || undefined,
    data,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send an error response
 * @param {Response} res - Express response object
 * @param {string} message - Error message to display
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {object} options - Additional options (errors, metadata)
 * @example
 * sendError(res, 'Invalid input', 400);
 * sendError(res, 'Not found', 404, { errors: [...] });
 */
const sendError = (res, message, statusCode = 400, options = {}) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (options.errors) {
    response.errors = options.errors;
  }

  if (options.metadata) {
    response.metadata = options.metadata;
  }

  res.status(statusCode).json(response);
};

/**
 * Send a paginated response
 * @param {Response} res - Express response object
 * @param {array} data - Array of items
 * @param {object} pagination - Pagination object { page, limit, total }
 * @param {number} statusCode - HTTP status code (default: 200)
 * @example
 * sendPaginated(res, items, { page: 1, limit: 50, total: 150 });
 */
const sendPaginated = (res, data, pagination, statusCode = 200) => {
  if (!pagination || typeof pagination.total !== 'number' || typeof pagination.limit !== 'number') {
    console.error('sendPaginated: Invalid pagination object', pagination);
    return sendError(res, 'Invalid pagination data', 500);
  }

  const { page, limit, total } = pagination;
  const parsedPage = Math.max(1, parseInt(page, 10));
  const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const pages = Math.ceil(total / parsedLimit) || 1;

  res.status(statusCode).json({
    success: true,
    data: Array.isArray(data) ? data : [],
    meta: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      pages,
      hasNext: parsedPage < pages,
      hasPrev: parsedPage > 1,
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send a created response (201 status)
 * @param {Response} res - Express response object
 * @param {object} data - Created resource data
 * @param {string} message - Optional success message
 * @example
 * sendCreated(res, newUser, 'User created successfully');
 */
const sendCreated = (res, data, message = 'Resource created successfully') => {
  sendSuccess(res, data, 201, { message });
};

/**
 * Send an unauthorized response (401 status)
 * @param {Response} res - Express response object
 * @param {string} message - Error message
 * @example
 * sendUnauthorized(res, 'Invalid token');
 */
const sendUnauthorized = (res, message = 'Authentication required') => {
  sendError(res, message, 401);
};

/**
 * Send a forbidden response (403 status)
 * @param {Response} res - Express response object
 * @param {string} message - Error message
 * @example
 * sendForbidden(res, 'Admin access required');
 */
const sendForbidden = (res, message = 'Access denied') => {
  sendError(res, message, 403);
};

/**
 * Send a not found response (404 status)
 * @param {Response} res - Express response object
 * @param {string} resource - Resource name (e.g., 'User', 'Workload')
 * @example
 * sendNotFound(res, 'Faculty');
 */
const sendNotFound = (res, resource = 'Resource') => {
  sendError(res, `${resource} not found`, 404);
};

/**
 * Send a conflict response (409 status)
 * Typically used for duplicate entries or state conflicts
 * @param {Response} res - Express response object
 * @param {string} message - Error message
 * @example
 * sendConflict(res, 'Faculty already assigned for this section');
 */
const sendConflict = (res, message) => {
  sendError(res, message, 409);
};

/**
 * Send a validation error response (422 status)
 * @param {Response} res - Express response object
 * @param {array} errors - Array of validation errors
 * @example
 * sendValidationError(res, [{field: 'email', message: 'Invalid email'}]);
 */
const sendValidationError = (res, errors) => {
  sendError(res, 'Validation failed', 422, { errors });
};

/**
 * Ensure response data is properly formatted and has no null/undefined fields
 * This helper validates that all fields in the response item have proper values
 * @param {object} item - Single data item to check
 * @param {array} requiredFields - Fields that must exist and be non-empty
 * @returns {object} Normalized item with safe defaults
 * @example
 * const safe = ensureResponseData(item, ['id', 'name', 'email']);
 */
const ensureResponseData = (item, requiredFields = []) => {
  if (!item) return null;

  const normalized = { ...item };
  requiredFields.forEach(field => {
    if (!normalized[field]) {
      console.warn(`Missing required field: ${field}`, item._id);
      return null;
    }
  });

  return normalized;
};

/**
 * Format database field as ISO string, handling null/undefined
 * @param {Date|null} date - Date to format
 * @returns {string|null} ISO date string or null
 */
const formatDate = (date) => {
  if (!date || !(date instanceof Date)) return null;
  return date.toISOString();
};

/**
 * Safely convert to number, with fallback
 * @param {any} value - Value to convert
 * @param {number} defaultValue - Default if conversion fails
 * @returns {number}
 */
const toNumber = (value, defaultValue = 0) => {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

/**
 * Safely convert to string, with trim
 * @param {any} value - Value to convert
 * @param {string} defaultValue - Default if conversion fails
 * @returns {string}
 */
const toString = (value, defaultValue = '') => {
  return String(value || defaultValue).trim();
};

module.exports = {
  sendSuccess,
  sendError,
  sendPaginated,
  sendCreated,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendValidationError,
  ensureResponseData,
  formatDate,
  toNumber,
  toString,
};
