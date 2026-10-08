/**
 * models/AcademicYearFaculty.js
 */
'use strict';

const { mongoose } = require('../db');

const academicYearFacultySchema = new mongoose.Schema(
  {
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
    status: { type: String, enum: ['Active', 'Inactive', 'Removed'], default: 'Active' },
    targetCapacity: { 
      type: Number, 
      default: function() {
        return require('../utils/designationUtils').getDefaultCapacity(this.designation);
      }
    },
    designation: { type: String, trim: true },
    department: { type: String, trim: true },
    removedAt: { type: Date, default: null },
    removedBy: { type: String, default: null },
  },
  { timestamps: true, collection: 'academic_year_faculties' }
);

academicYearFacultySchema.index({ academicYearId: 1, facultyId: 1 }, { unique: true });

module.exports = mongoose.model('AcademicYearFaculty', academicYearFacultySchema);
