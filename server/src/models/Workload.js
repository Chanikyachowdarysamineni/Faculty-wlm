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
    empId:       { type: String, required: true },
    empName:     { type: String, required: true },
    facultyRole: { type: String, enum: ['Main Faculty', 'Supporting Faculty', 'TA'], default: 'Main Faculty' },
    mobile:      { type: String, default: '' },
    department:  { type: String, default: 'CSE' },
    designation: { type: String, required: true },
    courseId:    { type: Number, default: 0 },
    courseType:  { type: String, default: 'Other' },
    courseTypeKey: { type: String, default: 'OTHER', index: true },
    subjectCode: { type: String, required: true },
    subjectName: { type: String, required: true },
    shortName:   { type: String, required: true },
    program:     { type: String, required: true },
    year:        { type: String, required: true },
    section:     { type: String, required: true },
    fixedL:      { type: Number, default: 0 },
    fixedT:      { type: Number, default: 0 },
    fixedP:      { type: Number, default: 0 },
    C:           { type: Number, default: 0 },
    manualL:     { type: Number, default: 0 },
    manualT:     { type: Number, default: 0 },
    manualP:     { type: Number, default: 0 },
    // Capacity in periods (hours) for faculty workload
    capacityHours: { type: Number, default: 0 },
    // Visibility toggle: whether faculty can see this workload assignment
    isVisible: { type: Boolean, default: false },
    // For TA role: slot index in tutorialSlots/practicalSlots arrays (1=R2, 2=R3, 3=R4)
    allocationRow: { type: Number, default: null },

  },
  { timestamps: true, collection: 'workloads' }
);

workloadSchema.pre('save', function preSave(next) {
  this.courseTypeKey = normalizeCourseTypeKey(this.courseType);
  next();
});

workloadSchema.pre('findOneAndUpdate', function preFindOneAndUpdate(next) {
  const update = this.getUpdate() || {};
  const rootCourseType = update.courseType;
  const setCourseType = update.$set?.courseType;
  const nextCourseType = setCourseType ?? rootCourseType;
  if (nextCourseType !== undefined) {
    if (!update.$set) update.$set = {};
    update.$set.courseTypeKey = normalizeCourseTypeKey(nextCourseType);
    this.setUpdate(update);
  }
  next();
});

// Prevent duplicate same-role assignment for the same faculty/course/year/section
workloadSchema.index({ empId: 1, courseId: 1, year: 1, section: 1, facultyRole: 1 }, { unique: true });
// Only one TA assignment is allowed per course + year + section.
workloadSchema.index(
  { courseId: 1, year: 1, section: 1, facultyRole: 1 },
  {
    unique: true,
    partialFilterExpression: { facultyRole: 'TA' },
    name: 'uniq_ta_per_course_section_year',
  }
);
// At most one Main Faculty Department Elective workload entry per section for I/II/III years.
workloadSchema.index(
  { year: 1, section: 1, courseTypeKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      courseTypeKey: 'DE',
      year: { $in: ['I', 'II', 'III'] },
      facultyRole: 'Main Faculty',
    },
    name: 'uniq_main_de_per_section_upto_third_year',
  }
);
workloadSchema.index({ courseId: 1, year: 1, section: 1, facultyRole: 1 });
// Note: { empId: 1, year: 1, section: 1 } is redundant with unique index at line 69
// which already indexes empId as first key. Removed to prevent duplicate index warning.
workloadSchema.index({ year: 1, section: 1, courseId: 1 });
workloadSchema.index({ subjectCode: 1 });

module.exports = mongoose.model('Workload', workloadSchema);
