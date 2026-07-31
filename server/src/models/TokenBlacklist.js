'use strict';

const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'tokenBlacklist' }
);

// Automatically remove expired tokens from the collection
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TokenBlacklist', tokenBlacklistSchema);
