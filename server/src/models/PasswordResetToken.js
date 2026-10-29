'use strict';

const { mongoose } = require('../db');
const crypto = require('crypto');

const passwordResetTokenSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    codeHash: { type: String, default: null, index: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    requestedByIp: { type: String, default: '' },
  },
  { timestamps: true, collection: 'password_reset_tokens' }
);

// Auto-delete expired tokens (TTL index)
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
passwordResetTokenSchema.index({ empId: 1, usedAt: 1, expiresAt: 1 });

/**
 * Hash a raw token string (SHA-256)
 */
passwordResetTokenSchema.statics.hashToken = function(rawToken) {
  if (!rawToken) return '';
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
};

/**
 * Hash a 6-digit verification code (HMAC-SHA256)
 */
passwordResetTokenSchema.statics.hashCode = function(rawCode) {
  if (!rawCode) return '';
  return crypto.createHmac('sha256', process.env.JWT_SECRET || 'wlm-reset-secret')
    .update(String(rawCode).trim())
    .digest('hex');
};

/**
 * Create a new password reset token & 6-digit code for a user
 * @param {string} empId - Employee ID
 * @param {number} ttlMinutes - Time to live in minutes (default: 15)
 * @param {string} ip - Requester IP address
 * @returns {Promise<{ rawToken: string, resetCode: string, expiresAt: Date }>}
 */
passwordResetTokenSchema.statics.createReset = async function(empId, ttlMinutes = 15, ip = '') {
  if (!empId) throw new Error('Employee ID is required');

  // Generate strong random 64-character token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = this.hashToken(rawToken);

  // Generate cryptographically secure 6-digit verification code
  const resetCode = String(crypto.randomInt(100000, 1000000));
  const codeHash = this.hashCode(resetCode);

  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  // Invalidate any previous active reset requests for this user
  await this.updateMany(
    { empId, usedAt: null },
    { $set: { usedAt: new Date() } }
  );

  // Create new reset token record
  await this.create({
    empId,
    tokenHash,
    codeHash,
    attempts: 0,
    expiresAt,
    requestedByIp: ip || '',
  });

  return { rawToken, resetCode, expiresAt };
};

/**
 * Verify a submitted token or verification code and mark it as used atomically
 * @param {Object} options
 * @param {string} [options.token] - Raw token from URL query
 * @param {string} [options.code] - 6-digit verification code
 * @param {string} [options.empId] - Employee ID (required if using code)
 * @returns {Promise<Object>} The verified token document
 */
passwordResetTokenSchema.statics.verifyAndUseTokenOrCode = async function({ token, code, empId }) {
  let tokenDoc = null;

  if (token) {
    const tokenHash = this.hashToken(token.trim());
    tokenDoc = await this.findOne({ tokenHash });
  } else if (code && empId) {
    const trimmedEmpId = String(empId).trim();
    const candidateCode = String(code).trim();
    const codeHash = this.hashCode(candidateCode);

    tokenDoc = await this.findOne({
      empId: trimmedEmpId,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!tokenDoc) {
      throw new Error('No active password reset request found for this account.');
    }

    if (tokenDoc.attempts >= 5) {
      tokenDoc.usedAt = new Date();
      await tokenDoc.save();
      throw new Error('Too many incorrect verification attempts. Please request a new password reset.');
    }

    if (tokenDoc.codeHash !== codeHash) {
      tokenDoc.attempts = (tokenDoc.attempts || 0) + 1;
      await tokenDoc.save();
      const remaining = 5 - tokenDoc.attempts;
      throw new Error(`Invalid verification code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'Please request a new reset code.'}`);
    }
  } else {
    throw new Error('Either a reset token or employee ID and verification code are required.');
  }

  if (!tokenDoc) {
    throw new Error('Invalid or expired password reset link.');
  }

  if (tokenDoc.usedAt) {
    throw new Error('This password reset link or code has already been used.');
  }

  if (new Date() > tokenDoc.expiresAt) {
    throw new Error('This password reset link or code has expired. Please request a new one.');
  }

  tokenDoc.usedAt = new Date();
  await tokenDoc.save();

  return tokenDoc;
};

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
