'use strict';

const mongoose = require('mongoose');
const crypto   = require('crypto');

const otpTokenSchema = new mongoose.Schema(
  {
    empId:          { type: String, required: true, trim: true },
    otpHash:        { type: String, required: true },          // Keyed HMAC-SHA-256 of the 6-digit OTP
    expiresAt:      { type: Date, required: true },
    usedAt:         { type: Date, default: null },
    attempts:       { type: Number, default: 0 },              // wrong-guess counter (max 5)
    deliveryStatus: { type: String, enum: ['pending', 'queued', 'processing', 'sent', 'failed'], default: 'pending' },
    deliveryError:  { type: String, default: null },
    deliveredAt:    { type: Date, default: null },
  },
  { timestamps: true, collection: 'otp_tokens' }
);

// Auto-purge docs 10 minutes after expiry
otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 600 });
otpTokenSchema.index({ empId: 1, usedAt: 1, expiresAt: 1 });
otpTokenSchema.index({ empId: 1, createdAt: -1 });

/** Hash a raw OTP string using keyed HMAC-SHA256 to prevent rainbow-table attacks */
otpTokenSchema.statics.hashOtp = (raw) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || 'wlm-otp-secret')
    .update(String(raw))
    .digest('hex');

/** Check if a recent active OTP was generated within cooldown window */
otpTokenSchema.statics.getRecentActiveOtp = async function (empId, cooldownSeconds = 60) {
  const cutoff = new Date(Date.now() - cooldownSeconds * 1000);
  return this.findOne({
    empId,
    usedAt: null,
    deliveryStatus: { $ne: 'failed' },
    createdAt: { $gt: cutoff },
  }).sort({ createdAt: -1 });
};

/** Generate a 6-digit OTP, persist it, and return raw OTP + docId */
otpTokenSchema.statics.createOtp = async function (empId, ttlMinutes = 10) {
  // Invalidate any existing OTPs for this user
  await this.deleteMany({ empId });

  // Cryptographically secure 6-digit OTP generation (CWE-338 fix)
  const raw = String(crypto.randomInt(100000, 1000000));
  const otpHash   = this.hashOtp(raw);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const doc = await this.create({
    empId,
    otpHash,
    expiresAt,
    deliveryStatus: 'pending',
  });
  return { raw, docId: doc._id };
};

module.exports = mongoose.model('OtpToken', otpTokenSchema);

