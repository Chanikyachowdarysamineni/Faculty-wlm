'use strict';

const mongoose = require('mongoose');

const emailJobSchema = new mongoose.Schema(
  {
    type:             { type: String, default: 'otp', index: true },
    empId:            { type: String, required: true, trim: true, index: true },
    to:               { type: String, required: true, trim: true, lowercase: true },
    subject:          { type: String, required: true },
    text:             { type: String, default: '' },
    html:             { type: String, default: '' },
    status:           { 
      type: String, 
      enum: ['pending', 'processing', 'sent', 'failed'], 
      default: 'pending', 
      index: true 
    },
    attempts:         { type: Number, default: 0 },
    maxAttempts:      { type: Number, default: 5 },
    nextAttemptAt:    { type: Date, default: Date.now, index: true },
    lockedAt:         { type: Date, default: null },
    lockedBy:         { type: String, default: null },
    sentAt:           { type: Date, default: null },
    lastError:        { type: String, default: null },
    isPermanentError: { type: Boolean, default: false },
    otpTokenId:       { type: mongoose.Schema.Types.ObjectId, ref: 'OtpToken', default: null },
    metadata:         { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { 
    timestamps: true, 
    collection: 'email_jobs' 
  }
);

// High-performance queue polling index
emailJobSchema.index({ status: 1, nextAttemptAt: 1, attempts: 1 });
emailJobSchema.index({ empId: 1, createdAt: -1 });

// Automatically expire completed/failed email logs after 7 days to keep collection lightweight
emailJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

module.exports = mongoose.model('EmailJob', emailJobSchema);
