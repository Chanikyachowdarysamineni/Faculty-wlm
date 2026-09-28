/**
 * models/AcademicYearSection.js
 */
'use strict';

const { mongoose } = require('../db');

const academicYearSectionSchema = new mongoose.Schema(
  {
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
    status: { type: String, enum: ['Active', 'Inactive', 'Removed'], default: 'Active' },
    year: { type: String, required: true, enum: ['I', 'II', 'III', 'IV'] },
    batch: { type: String, default: '' },
    removedAt: { type: Date, default: null },
    removedBy: { type: String, default: null },
  },
  { timestamps: true, collection: 'academic_year_sections' }
);

academicYearSectionSchema.index({ academicYearId: 1, sectionId: 1 }, { unique: true });

module.exports = mongoose.model('AcademicYearSection', academicYearSectionSchema);
