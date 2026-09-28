/**
 * models/AcademicYearSemester.js
 */
'use strict';

const { mongoose } = require('../db');

const academicYearSemesterSchema = new mongoose.Schema(
  {
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    semesterType: { type: String, enum: ['ODD', 'EVEN'], required: true },
    status: { type: String, enum: ['NOT_STARTED', 'ACTIVE', 'CLOSED'], default: 'NOT_STARTED' },
    formEnabled: { type: Boolean, default: false },
    editEnabled: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date }
  },
  { timestamps: true, collection: 'academic_year_semesters' }
);

// Ensure only one ODD and one EVEN semester per academic year
academicYearSemesterSchema.index({ academicYearId: 1, semesterType: 1 }, { unique: true });

module.exports = mongoose.model('AcademicYearSemester', academicYearSemesterSchema);
