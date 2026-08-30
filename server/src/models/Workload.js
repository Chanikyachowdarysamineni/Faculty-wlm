/**
 * models/Workload.js
 */
'use strict';

const { mongoose } = require('../db');

const normalizeCourseTypeKey = (courseType = '') => {
  const normalized = String(courseType || '').trim().toLowerCase();
  if (normalized === 'de' || normalized === 'department elective') return 'DE';
  if (normalized === 'mandatory') return 'MANDATORY';
  return 'OTHER';
};

const workloadSchema = new mongoose.Schema(
  {
    // ObjectId references (preferred; denormalized fields kept for backward compat)
    faculty:    { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
    course:     { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    sectionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },

    // ── Denormalized fields (kept in sync by route handlers) ─────────────
    empId:       { type: String, default: '', trim: true },
    empName:     { type: String, default: '' },
    courseId:    { type: Number, default: 0 },
    year:        { type: String, default: '' },
    section:     { type: String, default: '' },

    // Course-level denormalized data
    courseType:    { type: String, default: 'Other' },
    courseTypeKey: { type: String, default: 'OTHER' },  // 'DE' | 'MANDATORY' | 'OTHER'
    subjectCode:   { type: String, default: '' },
    subjectName:   { type: String, default: '' },
    shortName:     { type: String, default: '' },
    program:       { type: String, default: '' },
    C:             { type: Number, default: 0 },          // credits

    // Faculty-level denormalized data
    designation:   { type: String, default: '' },
    mobile:        { type: String, default: '' },
    department:    { type: String, default: 'CSE' },

    // Role of this faculty member for this course+section
    facultyRole: {
      type: String,
      enum: ['Main Faculty', 'Supporting Faculty', 'TA'],
      default: 'Main Faculty',
    },

    // ── Hour fields ───────────────────────────────────────────────────────
    // fixedL/T/P = values from Course at time of assignment (immutable copy)
    fixedL: { type: Number, default: 0 },
    fixedT: { type: Number, default: 0 },
    fixedP: { type: Number, default: 0 },
    // manualL/T/P = admin-overridden values (used for capacity calculation)
    manualL: { type: Number, default: 0 },
    manualT: { type: Number, default: 0 },
    manualP: { type: Number, default: 0 },

    // Whether this workload is visible to the faculty member
    isVisible: { type: Boolean, default: false },

    // For TA role: slot index in tutorialSlots/practicalSlots (1=R2, 2=R3, 3=R4)
    allocationRow: { type: Number, default: null },

    allocationStatus: {
      type: String,
      enum: ['UNALLOCATED', 'AVAILABLE', 'PENDING', 'ALLOCATED', 'CANCELLED'],
      default: 'ALLOCATED',
    },

    // Soft-delete support
    isDeleted:  { type: Boolean, default: false },
    deletedAt:  { type: Date,    default: null },
    updatedBy:  { type: String,  default: '' },
  },
  { timestamps: true, collection: 'workloads' }
);


// ── Indexes ────────────────────────────────────────────────────────────────
// Prevent duplicate same-role assignment for the same faculty/course/year/section
workloadSchema.index(
  { empId: 1, courseId: 1, year: 1, section: 1, facultyRole: 1 },
  { unique: true, name: 'uniq_emp_course_year_section_role' }
);

// Only one TA assignment per course + year + section.
workloadSchema.index(
  { courseId: 1, year: 1, section: 1, facultyRole: 1 },
  {
    unique: true,
    partialFilterExpression: { facultyRole: 'TA' },
    name: 'uniq_ta_per_course_section_year',
  }
);

// Compound query indexes
workloadSchema.index({ courseId: 1, year: 1, section: 1, facultyRole: 1 });
workloadSchema.index({ year: 1, section: 1, courseId: 1 });
workloadSchema.index({ subjectCode: 1 });
workloadSchema.index({ empId: 1, isDeleted: 1 });
workloadSchema.index({ allocationStatus: 1 });
// Matches exact sort order of GET /api/workloads
workloadSchema.index({ year: 1, section: 1, subjectCode: 1, createdAt: -1 });

module.exports = mongoose.model('Workload', workloadSchema);
