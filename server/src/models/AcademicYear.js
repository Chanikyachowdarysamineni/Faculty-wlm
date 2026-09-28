/**
 * models/AcademicYear.js
 */
'use strict';

const { mongoose } = require('../db');

const academicYearSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }, // e.g. "2026-2027"
    isCurrent: { type: Boolean, default: false },
    status: { type: String, enum: ['ACTIVE', 'CLOSED', 'ARCHIVED'], default: 'ACTIVE' },
    startDate: { type: Date },
    endDate: { type: Date }
  },
  { timestamps: true, collection: 'academic_years' }
);

// Ensure only one academic year can be current
academicYearSchema.pre('save', async function (next) {
  if (this.isCurrent) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { $set: { isCurrent: false } }
    );
  }
  next();
});

module.exports = mongoose.model('AcademicYear', academicYearSchema);
