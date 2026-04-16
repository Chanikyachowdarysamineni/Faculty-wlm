'use strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    empId:         { type: String, unique: true, required: true, trim: true },
    name:          { type: String, default: '' },
    designation:   { type: String, default: '' },
    mobile:        { type: String, default: '' },
    email:         { type: String, default: '' },
    passwordHash:  { type: String, required: true },
    role:          { type: String, enum: ['admin', 'faculty'], default: 'faculty' },
    // true only for the one faculty who can also access the admin dashboard
    canAccessAdmin: { type: Boolean, default: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    // Login tracking for audit logs (multi-session support enabled)
    lastLoginIp: { type: String, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'users' }
);

module.exports = mongoose.model('User', userSchema);
