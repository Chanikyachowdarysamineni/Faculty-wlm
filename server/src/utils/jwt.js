/**
 * utils/jwt.js — sign & verify JSON Web Tokens
 * 
 * JWT signing and verification are active and required for all authenticated requests.
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const jwt = require('jsonwebtoken');

// Validate JWT secret is configured (required for production)
const validateJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('❌  JWT_SECRET is not configured in .env');
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (secret.length < 32) {
    console.warn('⚠️  JWT_SECRET is less than 32 characters - not recommended for production');
  }
  return secret;
};

const SECRET  = validateJwtSecret();
const EXPIRES = process.env.JWT_EXPIRES_IN || '8h';

/**
 * Create a signed JWT for a user.
 * @param {{ id: string, role: 'admin'|'faculty', name?: string }} payload
 * @returns {string} signed token
 */
const signToken = (payload) =>
  jwt.sign(payload, SECRET, { expiresIn: EXPIRES });

/**
 * Verify and decode a JWT.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws {JsonWebTokenError} if invalid
 */
const verifyToken = (token) =>
  jwt.verify(token, SECRET);

module.exports = { signToken, verifyToken };
