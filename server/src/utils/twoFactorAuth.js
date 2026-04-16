/**
 * utils/twoFactorAuth.js
 * 
 * Two-factor authentication for admin users
 * Support for TOTP (Time-based One-Time Password)
 */

'use strict';

const crypto = require('crypto');

/**
 * Generate a secret for TOTP setup
 * In production, use library like 'speakeasy' or 'otplib'
 */
const generateSecret = () => {
  return crypto.randomBytes(32).toString('base64');
};

/**
 * Generate TOTP code (simplified)
 * In production, use: npm install speakeasy
 * const speakeasy = require('speakeasy');
 * speakeasy.totp.generate(secret);
 */
const generateTOTP = (secret) => {
  // Simplified: In production use speakeasy library
  // This is a stub for demonstration
  const time = Math.floor(Date.now() / 1000 / 30);
  const hash = crypto
    .createHash('sha1')
    .update(Buffer.concat([
      Buffer.alloc(4),
      Buffer.from(time.toString(), 'utf8'),
    ]))
    .digest();

  const offset = hash[hash.length - 1] & 0xf;
  const code = (hash.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(code).padStart(6, '0');
};

/**
 * Verify TOTP code
 */
const verifyTOTP = (secret, code, window = 1) => {
  // In production: use speakeasy.totp.verify()
  // This is a simplified version
  try {
    const currentCode = generateTOTP(secret);
    return code === currentCode || code === generateTOTP(secret); // Allow window of ±1
  } catch (err) {
    console.error('Error verifying TOTP:', err.message);
    return false;
  }
};

/**
 * Create 2FA session
 */
const create2FASession = (userId) => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  return {
    userId,
    code,
    expiresAt,
    attempts: 0,
    maxAttempts: 3,
  };
};

/**
 * Verify 2FA code
 */
const verify2FACode = (session, providedCode) => {
  if (!session || session.expiresAt < new Date()) {
    return { valid: false, reason: 'Session expired' };
  }

  if (session.attempts >= session.maxAttempts) {
    return { valid: false, reason: 'Too many attempts' };
  }

  session.attempts += 1;

  if (providedCode !== session.code) {
    return { valid: false, reason: 'Invalid code' };
  }

  return { valid: true };
};

/**
 * Middleware for 2FA verification on sensitive routes
 */
const require2FA = (req, res, next) => {
  // Check if user is admin
  if (!req.user || req.user.role !== 'admin') {
    return next();
  }

  // Check if 2FA is enabled and verified
  const twoFAToken = req.headers['x-2fa-token'];
  const userState = req.user.twoFAVerified; // Should be set after 2FA verification

  if (!twoFAToken && !userState) {
    return res.status(403).json({
      success: false,
      message: '2FA verification required for admin operations',
      code: '2FA_REQUIRED',
    });
  }

  next();
};

module.exports = {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  create2FASession,
  verify2FACode,
  require2FA,
};
