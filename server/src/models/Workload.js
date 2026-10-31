/**
 * models/Workload.js
 */
'use strict';

const { mongoose } = require('../db');

const { normalizeCourseTypeKey } = require('../utils/courseUtils');

const workloadSchema = new mongoose.Schema(
  {
    // ObjectId references (preferred; denormalized fields kept for backward compat)
    faculty:    { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
    course:     { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    sectionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    semester:   { type: String, enum: ['ODD', 'EVEN'], default: 'ODD' },

    // Phase 1 Expansion Fields (Nullable for migration)
    academicYearSemesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYearSemester', default: null },
    academicYearFacultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYearFaculty', default: null },
    courseOfferingId: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseOffering', default: null },

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

    // Academic Year Context
    academicYear:  { type: String, required: true},
    
    // ── First-Year Specific Fields ───────────────────────────────────────
    branch:        { type: String, default: '' },
    sections:      { type: [String], default: [] },
    workloadText:  { type: String, default: '' },
    cluster:       { type: String, default: '' },

    // Faculty-level denormalized data
    designation:   { type: String, default: '' },
    mobile:        { type: String, default: '' },
    department:    { type: String, default: 'CSE' },

    // Role of this faculty member for this course+section
    facultyRole: {
      type: String,
      default: 'Main Faculty',
    },

    // ── Hour fields ───────────────────────────────────────────────────────
    // fixedL/T/P = values from Course at time of assignment (immutable copy)
    fixedL: { type: Number, default: 0, min: 0, max: 100, validate: { validator: Number.isInteger } },
    fixedT: { type: Number, default: 0, min: 0, max: 100, validate: { validator: Number.isInteger } },
    fixedP: { type: Number, default: 0, min: 0, max: 100, validate: { validator: Number.isInteger } },
    // manualL/T/P = admin-overridden values (used for capacity calculation)
    manualL: { type: Number, default: 0, min: 0, max: 100, validate: { validator: Number.isInteger } },
    manualT: { type: Number, default: 0, min: 0, max: 100, validate: { validator: Number.isInteger } },
    manualP: { type: Number, default: 0, min: 0, max: 100, validate: { validator: Number.isInteger } },

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
  { timestamps: true, collection: 'workloads', autoIndex: false }
);



// Canonicalize year and isDeleted on save/validation
workloadSchema.pre('validate', function(next) {
  if (this.year) {
    const map = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', 'I': 'I', 'II': 'II', 'III': 'III', 'IV': 'IV' };
    const trimmed = String(this.year).trim();
    this.year = map[trimmed] || trimmed;
  }
  if (this.isDeleted === undefined || this.isDeleted === null) {
    this.isDeleted = false;
  }
  next();
});

// Clear faculty from allocations when workload is soft-deleted
workloadSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  if (update && (update.$set?.isDeleted === true || update.isDeleted === true)) {
    try {
      const opts = this.getOptions() || {};
      if (opts.skipAllocationSync) {
        return next();
      }
      const session = opts.session;
      const docToUpdate = await this.model.findOne(this.getQuery()).session(session).lean();
      if (docToUpdate && docToUpdate.empId) {
        const Allocation = mongoose.model('CourseAllocation');
        const romanOrder = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', 'I': '1', 'II': '2', 'III': '3', 'IV': '4' };
        const yrVariants = Array.from(new Set([String(docToUpdate.year), romanOrder[String(docToUpdate.year)]].filter(Boolean)));
        
        const query = {
          courseId: Number(docToUpdate.courseId),
          section: String(docToUpdate.section).trim(),
          year: { $in: yrVariants },
          isDeleted: { $ne: true }
        };
        if (docToUpdate.academicYear) query.academicYear = String(docToUpdate.academicYear).trim();
        if (docToUpdate.semester) query.semester = String(docToUpdate.semester).trim().toUpperCase();

        const allocs = await Allocation.find(query).session(session);
        for (const a of allocs) {
          let modified = false;
          const clearSlot = (slot) => {
            if (slot && String(slot.empId || '').trim() === String(docToUpdate.empId).trim()) {
              slot.empId = '';
              slot.empName = '';
              slot.designation = '';
              slot.faculty = null;
              slot.hours = 0;
              modified = true;
            }
          };

          if (a.lectureSlot) clearSlot(a.lectureSlot);
          ['lectureSlots', 'tutorialSlots', 'practicalSlots'].forEach(slotType => {
            if (Array.isArray(a[slotType])) a[slotType].forEach(clearSlot);
          });

          if (modified) await a.save({ session });
        }
      }
    } catch (err) {
      // Ignore hook error so it doesn't block transaction abort
    }
  }
  next();
});

// ── Indexes ────────────────────────────────────────────────────────────────
// Prevent duplicate same-role assignment for the same faculty/course/year/section/academicYear
workloadSchema.index(
  { empId: 1, courseId: 1, year: 1, section: 1, facultyRole: 1, semester: 1, academicYear: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false }, name: 'uniq_emp_course_year_section_role' }
);

// Only one TA assignment per row (R2, R3, R4) per course + year + section + academicYear.
workloadSchema.index(
  { courseId: 1, year: 1, section: 1, facultyRole: 1, allocationRow: 1, semester: 1, academicYear: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false, facultyRole: 'TA' },
    name: 'uniq_ta_per_course_section_year',
  }
);

// Only one Main Faculty assignment per course + year + section + academicYear.
workloadSchema.index(
  { courseId: 1, year: 1, section: 1, facultyRole: 1, semester: 1, academicYear: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false, facultyRole: 'Main Faculty' },
    name: 'uniq_main_per_course_section_year',
  }
);

// Compound query indexes
workloadSchema.index({ courseId: 1, year: 1, section: 1, facultyRole: 1, semester: 1, academicYear: 1 });
workloadSchema.index({ year: 1, section: 1, courseId: 1 });
workloadSchema.index({ subjectCode: 1 });
workloadSchema.index({ empId: 1, isDeleted: 1 });
workloadSchema.index({ allocationStatus: 1 });
// Matches exact sort order of GET /api/workloads
workloadSchema.index({ year: 1, section: 1, subjectCode: 1, createdAt: -1 });

module.exports = mongoose.model('Workload', workloadSchema);
