'use strict';

const mongoose = require('mongoose');
const crypto   = require('crypto');

const otpTokenSchema = new mongoose.Schema(
  {
    empId:     { type: String, required: true, trim: true },
    otpHash:   { type: String, required: true },          // SHA-256 of the 6-digit OTP
    expiresAt: { type: Date, required: true },
    usedAt:    { type: Date, default: null },
    attempts:  { type: Number, default: 0 },              // wrong-guess counter (max 5)
  },
  { timestamps: true, collection: 'otp_tokens' }
);

// Auto-purge docs 10 minutes after expiry
otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 600 });
otpTokenSchema.index({ empId: 1 });

/** Hash a raw OTP string */
otpTokenSchema.statics.hashOtp = (raw) =>
  crypto.createHash('sha256').update(String(raw)).digest('hex');

/** Generate a 6-digit OTP, persist it, and return the raw value */
otpTokenSchema.statics.createOtp = async function (empId, ttlMinutes = 10) {
  // Invalidate any existing OTPs for this user
  await this.deleteMany({ empId });

  const raw = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  const otpHash  = this.hashOtp(raw);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  await this.create({ empId, otpHash, expiresAt });
  return raw;
};

module.exports = mongoose.model('OtpToken', otpTokenSchema);
