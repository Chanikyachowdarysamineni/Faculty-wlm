/**
 * utils/requestSigning.js
 * 
 * Request signing for sensitive operations
 * Uses HMAC-SHA256 to sign critical API requests
 */

'use strict';

const crypto = require('crypto');

const SECRET_KEY = process.env.REQUEST_SIGNING_SECRET || process.env.JWT_SECRET;

/**
 * Sign a request payload
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {object} payload - Request body
 * @returns {string} - Signature header value
 */
const signRequest = (method, path, payload = {}) => {
  if (!SECRET_KEY) {
    console.warn('⚠️  REQUEST_SIGNING_SECRET not configured');
    return '';
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const payload_str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const message = `${method}:${path}:${timestamp}:${payload_str}`;
  
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(message)
    .digest('hex');

  return `t=${timestamp},s=${signature}`;
};

/**
 * Verify a request signature
 * @param {string} signatureHeader - The X-Signature header value
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {object} payload - Request body
 * @param {number} maxAge - Max age in seconds (default: 300)
 * @returns {boolean} - Whether signature is valid
 */
const verifySignature = (signatureHeader, method, path, payload = {}, maxAge = 300) => {
  if (!signatureHeader || !SECRET_KEY) return false;

  try {
    const parts = signatureHeader.split(',');
    const timestamp = parseInt(parts[0].split('=')[1], 10);
    const providedSignature = parts[1].split('=')[1];

    // Check timestamp is not too old
    const now = Math.floor(Date.now() / 1000);
    if (now - timestamp > maxAge) {
      console.warn('⚠️  Request signature expired');
      return false;
    }

    // Verify signature
    const payload_str = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const message = `${method}:${path}:${timestamp}:${payload_str}`;
    
    const expectedSignature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(message)
      .digest('hex');

    const isValid = providedSignature === expectedSignature;
    if (!isValid) {
      console.warn('⚠️  Invalid request signature');
    }
    return isValid;
  } catch (err) {
    console.error('Error verifying signature:', err.message);
    return false;
  }
};

/**
 * Middleware to verify request signatures on sensitive endpoints
 */
const verifyRequestSignature = (maxAge = 300) => {
  return (req, res, next) => {
    const signature = req.headers['x-signature'];
    if (!signature) {
      return res.status(401).json({
        success: false,
        message: 'Missing X-Signature header',
      });
    }

    const isValid = verifySignature(
      signature,
      req.method,
      req.path,
      req.body || {},
      maxAge
    );

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired request signature',
      });
    }

    next();
  };
};

module.exports = {
  signRequest,
  verifySignature,
  verifyRequestSignature,
};
