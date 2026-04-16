'use strict';

const { mongoose } = require('../db');
const crypto = require('crypto');

const passwordResetTokenSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    requestedByIp: { type: String, default: '' },
  },
  { timestamps: true, collection: 'password_reset_tokens' }
);

// Auto-delete expired tokens (TTL index)
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Hash a raw token (one-way encryption for storage)
 */
passwordResetTokenSchema.statics.hashToken = function(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

/**
 * Create a new password reset token for a user
 * @param {string} empId - Employee ID
 * @param {number} ttlMinutes - Time to live in minutes (default: 30)
 * @returns {string} Raw token to send via email
 */
passwordResetTokenSchema.statics.createReset = async function(empId, ttlMinutes = 30) {
  if (!empId) throw new Error('Employee ID is required');
  
  // Generate strong random token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = this.hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  
  // Invalidate any previous reset requests for this user
  await this.deleteMany({ empId });
  
  // Create new reset token
  await this.create({
    empId,
    tokenHash,
    expiresAt,
  });
  
  console.log(`✅ Reset token created for ${empId}, expires in ${ttlMinutes} minutes`);
  return rawToken;
};

/**
 * Verify a submitted token and mark it as used
 */
passwordResetTokenSchema.methods.verifyAndUse = async function() {
  if (this.usedAt) {
    throw new Error('This reset token has already been used.');
  }
  
  if (new Date() > this.expiresAt) {
    throw new Error('This reset token has expired.');
  }
  
  this.usedAt = new Date();
  await this.save();
  
  console.log(`✅ Reset token verified and marked as used for ${this.empId}`);
  return true;
};

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
