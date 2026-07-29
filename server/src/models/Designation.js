'use strict';

const { mongoose } = require('../db');

const designationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    order: { type: Number, default: 0 },
    isEnabled: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'designations' }
);

module.exports = mongoose.model('Designation', designationSchema);
