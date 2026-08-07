'use strict';

const { mongoose } = require('../db');

const sectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g., '1', '2', 'A'
    code: { type: String, trim: true, default: '' },
    department: { type: String, default: 'CSE', trim: true },
    year: { type: String, required: true, enum: ['I', 'II', 'III', 'IV'] },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    description: { type: String, trim: true, default: '' },
    displayName: { type: String, trim: true, default: '' },
    sectionType: { type: String, enum: ['Regular', 'Honours', 'Minors'], default: 'Regular' },
    isDeleted: { type: Boolean, default: false }, // Soft delete
  },
  { timestamps: true, collection: 'sections' }
);

// Prevent duplicate active sections in the same year/department
sectionSchema.index({ name: 1, year: 1, department: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

module.exports = mongoose.model('Section', sectionSchema);
