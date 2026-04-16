/**
 * models/Setting.js
 */
'use strict';

const { mongoose } = require('../db');

const settingSchema = new mongoose.Schema(
  {
    key:   { type: String, required: true, unique: true },
    value: { type: String, required: true },
  },
  { timestamps: true, collection: 'settings' }
);

module.exports = mongoose.model('Setting', settingSchema);
