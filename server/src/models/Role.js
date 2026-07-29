'use strict';

const { mongoose } = require('../db');

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    permissions: [{ type: String }],
    isSystem: { type: Boolean, default: false }, // System roles like Admin cannot be deleted
  },
  { timestamps: true, collection: 'roles' }
);

module.exports = mongoose.model('Role', roleSchema);
