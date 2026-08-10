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
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
    course:  { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    sectionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    
    // Kept for backward compatibility during migration, but should be derived from references
    empId:       { type: String, default: '' },
    courseId:    { type: Number, default: 0 },
    year:        { type: String, default: '' },
    section:     { type: String, default: '' },
    
    facultyRole: { type: String, enum: ['Main Faculty', 'Supporting Faculty', 'TA'], default: 'Main Faculty' },
    
    // Mutable fields specific to the workload assignment itself
    fixedL:      { type: Number, default: 0 },
    fixedT:      { type: Number, default: 0 },
    fixedP:      { type: Number, default: 0 },
    manualL:     { type: Number, default: 0 },
    manualT:     { type: Number, default: 0 },
    manualP:     { type: Number, default: 0 },
    
    // Visibility toggle: whether faculty can see this workload assignment
    isVisible: { type: Boolean, default: false },
    // For TA role: slot index in tutorialSlots/practicalSlots arrays (1=R2, 2=R3, 3=R4)
    allocationRow: { type: Number, default: null },
    
    // Status of this workload assignment
    allocationStatus: { 
      type: String, 
      enum: ['UNALLOCATED', 'AVAILABLE', 'PENDING', 'ALLOCATED', 'CANCELLED'], 
      default: 'ALLOCATED' 
    },

  },
  { timestamps: true, collection: 'workloads' }
);



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
// Now handled at the application level during allocation since courseType is in Course model.
workloadSchema.index({ courseId: 1, year: 1, section: 1, facultyRole: 1 });
// Note: { empId: 1, year: 1, section: 1 } is redundant with unique index at line 69
// which already indexes empId as first key. Removed to prevent duplicate index warning.
workloadSchema.index({ year: 1, section: 1, courseId: 1 });
workloadSchema.index({ subjectCode: 1 });
// Index matching the exact sort order of GET /api/workloads
workloadSchema.index({ year: 1, section: 1, subjectCode: 1, createdAt: -1 });

module.exports = mongoose.model('Workload', workloadSchema);
