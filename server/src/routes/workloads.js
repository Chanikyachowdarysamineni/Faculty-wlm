/**
 * routes/workloads.js
 *
 * GET    /api/workloads              — list (admin sees all; faculty sees own)
 * GET    /api/workloads/export/csv   — CSV download (admin)
 * GET    /api/workloads/faculty-hours/:empId — get faculty workload summary (admin/faculty)
 * GET    /api/workloads/workload-report — get all faculty workload report (admin)
 * GET    /api/workloads/:id          — get one
 * POST   /api/workloads              — assign (admin). NOW WITH HOUR VALIDATION
 * PUT    /api/workloads/:id          — update (admin)
 * DELETE /api/workloads/:id          — delete (admin)
 */

'use strict';

const express   = require('express');
const { body, validationResult } = require('express-validator');
const Workload  = require('../models/Workload');
const Faculty   = require('../models/Faculty');
const Course    = require('../models/Course');
const CourseAllocation = require('../models/CourseAllocation');
const Setting   = require('../models/Setting');
const { parsePagination, buildMeta } = require('../utils/pagination');
const { logAuditEvent } = require('../utils/audit');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendSuccess, sendError, sendValidationError, sendPaginated, sendCreated, sendConflict, sendNotFound } = require('../utils/response');
const logger = require('../utils/logger');
const { validateWorkloadCreate, validateWorkloadUpdate, validateWorkloadDelete, validatePagination } = require('../middleware/validators');
const { calculateFacultyWorkload, getFacultyWorkloadSummary, canAssignWorkload, getFacultyWorkloadReport } = require('../utils/workloadHours');

const router = express.Router();

const MAIN_FACULTY_DUPLICATE_MSG = 'Faculty already assigned for this section and course.';
const FACULTY_ROLES = ['Main Faculty', 'Supporting Faculty', 'TA'];
const ROLE_DUPLICATE_MSG = 'This faculty is already assigned with the same role for this course, year, and section.';
const DE_SECTION_DUPLICATE_MSG = 'Only one Department Elective can be assigned to the same section for I/II/III years.';
const TA_SECTION_DUPLICATE_MSG = 'TA is already assigned for this subject and section. Only one TA is allowed per section.';
const DE_COURSE_TYPE_REGEX = /^\s*(de|department\s+elective)\s*$/i;

// CRITICAL: Normalize year format (numeric or Roman numeral) to canonical form
// Maps: '1' -> 'I', '2' -> 'II', '3' -> 'III', '4' -> 'IV', 'M.Tech' -> 'M.Tech'
const normalizeYear = (year) => {
  const trimmed = String(year || '').trim().toUpperCase();
  if (trimmed === 'I' || trimmed === '1') return 'I';
  if (trimmed === 'II' || trimmed === '2') return 'II';
  if (trimmed === 'III' || trimmed === '3') return 'III';
  if (trimmed === 'IV' || trimmed === '4') return 'IV';
  if (trimmed === 'M.TECH') return 'M.Tech';
  return trimmed; // Return as-is if not recognized
};

const isDuplicateKeyError = (err) =>
  !!err && (err.code === 11000 || err.code === 11001);

const normalizeCourseTypeKey = (courseType = '') => {
  const normalized = String(courseType || '').trim().toLowerCase();
  if (normalized === 'de' || normalized === 'department elective') return 'DE';
  if (normalized === 'mandatory') return 'MANDATORY';
  return 'OTHER';
};

const isRestrictedDeYear = (year = '') => ['I', 'II', 'III'].includes(String(year || '').trim());

const isDeUniqueIndexError = (err) => {
  if (!isDuplicateKeyError(err)) return false;
  const msg = String(err?.message || '');
  if (msg.includes('uniq_main_de_per_section_upto_third_year')) return true;
  if (msg.includes('uniq_de_per_section_upto_third_year')) return true;
  const keyPattern = err?.keyPattern || {};
  return keyPattern.year === 1 && keyPattern.section === 1 && keyPattern.courseTypeKey === 1;
};

const isTaUniqueIndexError = (err) => {
  if (!isDuplicateKeyError(err)) return false;
  if (String(err?.message || '').includes('uniq_ta_per_course_section_year')) return true;
  const keyPattern = err?.keyPattern || {};
  return keyPattern.courseId === 1 && keyPattern.year === 1 && keyPattern.section === 1 && keyPattern.facultyRole === 1;
};

const buildDeSectionConflictFilter = ({ year, section, excludeId }) => {
  const filter = {
    year: String(year || '').trim(),
    section: String(section || '').trim(),
    facultyRole: 'Main Faculty',
    $or: [
      { courseTypeKey: 'DE' },
      { courseType: { $regex: DE_COURSE_TYPE_REGEX } },
    ],
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  return filter;
};

const sec = (n) => Array.from({ length: n }, (_, i) => String(i + 1));
const DEFAULT_SECTIONS = {
  I: sec(19), II: sec(22), III: sec(19), IV: sec(9), 'M.Tech': ['1', '2'],
};

const getSectionsConfig = async () => {
  const doc = await Setting.findOne({ key: 'sections_config' }).lean();
  if (!doc?.value) return DEFAULT_SECTIONS;
  try {
    const parsed = JSON.parse(doc.value);
    return { ...DEFAULT_SECTIONS, ...(parsed || {}) };
  } catch {
    return DEFAULT_SECTIONS;
  }
};

const ensureValidSection = async (year, section) => {
  const cfg = await getSectionsConfig();
  if (!cfg[year]) return { ok: true };
  if (!cfg[year].includes(section)) {
    return { ok: false, message: `Invalid section '${section}' for year '${year}'.` };
  }
  return { ok: true };
};

const toClient = (doc) => ({
  id:          doc._id?.toString() || '',
  empId:       String(doc.empId || '').trim(),
  empName:     String(doc.empName || '').trim(),
  facultyRole: String(doc.facultyRole || 'Main Faculty').trim(),
  designation: String(doc.designation || '').trim() || 'N/A',
  mobile:      String(doc.mobile || '').trim() || 'N/A',
  department:  String(doc.department || '').trim() || 'CSE',
  courseId:    Number(doc.courseId || 0),
  courseType:  String(doc.courseType || '').trim() || 'Other',
  subjectCode: String(doc.subjectCode || '').trim(),
  subjectName: String(doc.subjectName || '').trim(),
  shortName:   String(doc.shortName || '').trim(),
  program:     String(doc.program || '').trim() || 'N/A',
  year:        String(doc.year || '').trim() || 'I',
  section:     String(doc.section || '').trim() || '1',
  fixedL:      Number(doc.fixedL || 0),
  fixedT:      Number(doc.fixedT || 0),
  fixedP:      Number(doc.fixedP || 0),
  C:           Number(doc.C || 0),
  manualL:     Number(doc.manualL || 0),
  manualT:     Number(doc.manualT || 0),
  manualP:     Number(doc.manualP || 0),
  capacityHours: Number(doc.capacityHours || 0),
  isVisible:   doc.isVisible === true,
  allocationRow: doc.allocationRow ?? null,
  assignedAt:  doc.createdAt?.toISOString() || null,
});

const toPrimarySlot = (faculty, hours = 0) => ({
  empId: String(faculty?.empId || '').trim(),
  empName: String(faculty?.empName || faculty?.name || '').trim(),
  designation: String(faculty?.designation || '').trim(),
  hours: Number(hours || 0),
});

const emptyFacultySlot = () => ({ empId: '', empName: '', designation: '', hours: 0 });

// Normalize slot array to fixed MAX_SLOTS size, preserving positions.
const MAX_SLOTS = 4;
const normalizeSlots = (slots = []) =>
  Array.from({ length: MAX_SLOTS }, (_, i) => {
    const s = Array.isArray(slots) ? slots[i] : null;
    return (s && s.empId)
      ? { empId: s.empId, empName: s.empName || '', designation: s.designation || '', hours: Number(s.hours || 0) }
      : emptyFacultySlot();
  });

const syncMainFacultyToAllocation = async ({ courseId, year, section, faculty }) => {
  const numericCourseId = Number(courseId || 0);
  if (!numericCourseId || !year || !section || !faculty?.empId) return;

  const course = await Course.findOne({ courseId: numericCourseId }).lean();
  if (!course) return;

  const existing = await CourseAllocation.findOne({ courseId: numericCourseId, year, section }).lean();

  const lecturePrimary = toPrimarySlot(faculty, course.L);
  const tutorialPrimary = toPrimarySlot(faculty, course.T);
  const practicalPrimary = toPrimarySlot(faculty, course.P);

  const existingLectureSlots = Array.isArray(existing?.lectureSlots) ? existing.lectureSlots : [];
  const existingTutorialSlots = Array.isArray(existing?.tutorialSlots) ? existing.tutorialSlots : [];
  const existingPracticalSlots = Array.isArray(existing?.practicalSlots) ? existing.practicalSlots : [];

  // Build position-preserving slot arrays (slot 0 = main, 1-3 = supporting/TA)
  const lectureSlots = normalizeSlots(existingLectureSlots);
  lectureSlots[0] = lecturePrimary;

  const tutorialSlots = normalizeSlots(existingTutorialSlots);
  if (course.T > 0) tutorialSlots[0] = tutorialPrimary;

  const practicalSlots = normalizeSlots(existingPracticalSlots);
  if (course.P > 0) practicalSlots[0] = practicalPrimary;

  const lectureSlot = lectureSlots[0] || {};

  await CourseAllocation.findOneAndUpdate(
    { courseId: numericCourseId, year, section },
    {
      $set: {
        courseId: numericCourseId,
        subjectCode: course.subjectCode,
        subjectName: course.subjectName,
        shortName: course.shortName,
        program: course.program,
        year,
        section,
        fixedL: Number(course.L || 0),
        fixedT: Number(course.T || 0),
        fixedP: Number(course.P || 0),
        C: Number(course.C || 0),
        lectureSlots,
        lectureSlot,
        tutorialSlots,
        practicalSlots,
      },
    },
    { upsert: true, new: true }
  );
};

const clearMainFacultyFromAllocation = async ({ courseId, year, section, empId }) => {
  const numericCourseId = Number(courseId || 0);
  if (!numericCourseId || !year || !section || !empId) return;

  const existing = await CourseAllocation.findOne({ courseId: numericCourseId, year, section }).lean();
  if (!existing) return;

  const shouldClearPrimary = (slots = []) => (
    Array.isArray(slots) && slots[0]?.empId && String(slots[0].empId) === String(empId)
  );

  // Preserve positions: normalize to MAX_SLOTS then clear slot 0 if it was this faculty
  const lectureSlots = normalizeSlots(existing.lectureSlots);
  const tutorialSlots = normalizeSlots(existing.tutorialSlots);
  const practicalSlots = normalizeSlots(existing.practicalSlots);

  if (shouldClearPrimary(existing.lectureSlots))  lectureSlots[0]  = emptyFacultySlot();
  if (shouldClearPrimary(existing.tutorialSlots)) tutorialSlots[0] = emptyFacultySlot();
  if (shouldClearPrimary(existing.practicalSlots)) practicalSlots[0] = emptyFacultySlot();

  await CourseAllocation.findOneAndUpdate(
    { courseId: numericCourseId, year, section },
    {
      $set: {
        lectureSlots,
        lectureSlot: lectureSlots[0] || {},
        tutorialSlots,
        practicalSlots,
      },
    },
    { new: true }
  );
};

// Sync a TA workload assignment to the allocation at the specified row index (1-3)
const syncTAToAllocation = async ({ courseId, year, section, faculty, allocationRow }) => {
  const numericCourseId = Number(courseId || 0);
  const rowIdx = Number(allocationRow || 0);
  if (!numericCourseId || !year || !section || !faculty?.empId || rowIdx < 1 || rowIdx > 3) return;

  const course = await Course.findOne({ courseId: numericCourseId }).lean();
  if (!course) return;

  const taSlot = toPrimarySlot(faculty, 0);
  const existing = await CourseAllocation.findOne({ courseId: numericCourseId, year, section }).lean();

  const tutorialSlots = normalizeSlots(existing?.tutorialSlots);
  const practicalSlots = normalizeSlots(existing?.practicalSlots);
  if (course.T > 0) tutorialSlots[rowIdx] = taSlot;
  if (course.P > 0) practicalSlots[rowIdx] = taSlot;

  await CourseAllocation.findOneAndUpdate(
    { courseId: numericCourseId, year, section },
    {
      $set: {
        courseId: numericCourseId,
        subjectCode: course.subjectCode,
        subjectName: course.subjectName,
        shortName: course.shortName,
        program: course.program,
        year,
        section,
        fixedL: Number(course.L || 0),
        fixedT: Number(course.T || 0),
        fixedP: Number(course.P || 0),
        C: Number(course.C || 0),
        tutorialSlots,
        practicalSlots,
      },
    },
    { upsert: true, new: true }
  );
};

// Clear a TA from the allocation at the specified row index
const clearTAFromAllocation = async ({ courseId, year, section, allocationRow }) => {
  const numericCourseId = Number(courseId || 0);
  const rowIdx = Number(allocationRow || 0);
  if (!numericCourseId || !year || !section || rowIdx < 1 || rowIdx > 3) return;

  const existing = await CourseAllocation.findOne({ courseId: numericCourseId, year, section }).lean();
  if (!existing) return;

  const tutorialSlots = normalizeSlots(existing.tutorialSlots);
  const practicalSlots = normalizeSlots(existing.practicalSlots);
  tutorialSlots[rowIdx] = emptyFacultySlot();
  practicalSlots[rowIdx] = emptyFacultySlot();

  await CourseAllocation.findOneAndUpdate(
    { courseId: numericCourseId, year, section },
    { $set: { tutorialSlots, practicalSlots } },
    { new: true }
  );
};

// GET /api/workloads
// List workloads with filtering. Properly returns ALL records matching the filter (uses find(), NOT findOne())
router.get('/', requireAuth, validatePagination, async (req, res, next) => {
  try {
    // Disable caching to prevent 304 Not Modified responses
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    const isDualAccessAdmin = req.user?.canAccessAdmin === true;
    const isFacultyOnly = req.user.role === 'faculty' && !isDualAccessAdmin;
    const effectiveEmp = isFacultyOnly ? req.user.id : req.query.empId;
    if (effectiveEmp) filter.empId = effectiveEmp;
    // CRITICAL: Normalize year to canonical format (I/II/III/IV or M.Tech) for filtering
    if (req.query.year) filter.year = normalizeYear(req.query.year);
    if (req.query.section) filter.section = String(req.query.section).trim();
    if (req.query.courseId) filter.courseId = Number(req.query.courseId);
    // Faculty users can only see workloads where isVisible === true
    if (isFacultyOnly) {
      filter.isVisible = true;
    }
    if (req.query.search) {
      const q = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { empId:       { $regex: q, $options: 'i' } },
        { empName:     { $regex: q, $options: 'i' } },
        { subjectCode: { $regex: q, $options: 'i' } },
        { subjectName: { $regex: q, $options: 'i' } },
      ];
    }
    
    // CRITICAL: Always use find() to get ALL matching records, never findOne()
    // This ensures multiple faculty workloads in the same section are returned
    const [total, docs] = await Promise.all([
      Workload.countDocuments(filter),
      Workload.find(filter)
        .select('empId empName facultyRole designation mobile department courseId courseType subjectCode subjectName shortName program year section fixedL fixedT fixedP C manualL manualT manualP capacityHours isVisible allocationRow createdAt')
        .sort({ year: 1, section: 1, subjectCode: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);
    
    logger.info('Workloads listed', { 
      userId: req.user.id, 
      filter: JSON.stringify(filter), 
      total, 
      page, 
      limit, 
      returnedDocs: docs.length 
    });
    sendPaginated(res, docs.map(toClient), { total, page, limit }, 200);
  } catch (err) { 
    logger.error('Error listing workloads', { error: err.message, userId: req.user.id });
    next(err); 
  }
});

// GET /api/workloads/export/csv  (admin)
router.get('/export/csv', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const docs = await Workload.find().sort({ empId: 1, createdAt: 1 }).lean();
    const headers = ['#','Emp ID','Name','Faculty Role','Designation','Subject Code','Subject Name','Short',
      'Year','Section','Fixed L','Fixed T','Fixed P','C','Manual L','Manual T','Manual P','Assigned At'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      headers.map(esc).join(','),
      ...docs.map((w, i) => [
        i+1, w.empId, w.empName, w.facultyRole || 'Main Faculty', w.designation, w.subjectCode, w.subjectName, w.shortName,
        w.year, w.section, w.fixedL, w.fixedT, w.fixedP, w.C,
        w.manualL, w.manualT, w.manualP, w.createdAt,
      ].map(esc).join(',')),
    ].join('\r\n');
    logger.info('Workload CSV export', { userId: req.user.id, count: docs.length });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="workload_assignments.csv"');
    res.send(csv);
  } catch (err) { 
    logger.error('Error exporting workload CSV', { error: err.message, userId: req.user.id });
    next(err); 
  }
});

// GET /api/workloads/section-workloads?year=X&section=Y
// Fetch all workloads for a specific section
router.get('/section-workloads', requireAuth, async (req, res, next) => {
  try {
    // Disable caching to prevent 304 Not Modified responses
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    // CRITICAL: Normalize year to canonical format (I/II/III/IV or M.Tech) for consistent filtering
    const year = normalizeYear(req.query.year);
    const section = String(req.query.section || '').trim();

    if (!year || !section) {
      logger.warn('Missing year or section in section-workloads query', { userId: req.user.id, year, section });
      return sendError(res, 'Both year and section are required.', 400);
    }

    const filter = { year, section };
    const docs = await Workload.find(filter)
      .select('empId empName facultyRole designation mobile department courseId courseType subjectCode subjectName shortName program year section fixedL fixedT fixedP C manualL manualT manualP allocationRow createdAt')
      .sort({ facultyRole: 1, subjectCode: 1, createdAt: -1 })
      .lean();

    logger.info('Section workloads retrieved', { userId: req.user.id, year, section, total: docs.length });
    sendSuccess(res, docs.map(toClient), 200);
  } catch (err) { 
    logger.error('Error retrieving section workloads', { error: err.message, userId: req.user.id });
    next(err); 
  }
});

// GET /api/workloads/main-faculty?year=III
// Returns mapping: { '<courseId>__<section>': { empId, empName, designation, ... } }
router.get('/main-faculty', requireAuth, async (req, res, next) => {
  try {
    // Disable caching to prevent 304 Not Modified responses
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const year = req.query.year;
    if (!year) {
      logger.warn('Missing year in main-faculty query', { userId: req.user.id });
      return sendError(res, 'Year is required.', 400);
    }
    // CRITICAL: Normalize year to canonical format (I/II/III/IV or M.Tech) for consistent filtering
    const normalizedYear = normalizeYear(year);
    const docs = await Workload.find({ year: normalizedYear, facultyRole: 'Main Faculty' }).lean();
    // Map: courseId__section => faculty details (first found for each combo)
    const map = {};
    for (const w of docs) {
      const key = `${w.courseId}__${w.section}`;
      if (!map[key]) {
        map[key] = {
          empId: w.empId,
          empName: w.empName,
          designation: w.designation,
          courseId: w.courseId,
          section: w.section,
          year: w.year
        };
      }
    }
    logger.info('Main faculty mapping retrieved', { userId: req.user.id, year: normalizedYear, total: Object.keys(map).length });
    sendSuccess(res, map, 200);
  } catch (err) { 
    logger.error('Error retrieving main-faculty mapping', { error: err.message, userId: req.user.id });
    next(err); 
  }
});

// GET /api/workloads/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await Workload.findById(req.params.id).lean();
    if (!doc) {
      logger.warn('Workload entry not found', { id: req.params.id, userId: req.user.id });
      return sendNotFound(res, 'Workload entry not found.');
    }
    if (req.user.role === 'faculty' && doc.empId !== req.user.id) {
      logger.warn('Unauthorized access to workload', { id: req.params.id, userId: req.user.id, docEmpId: doc.empId });
      return sendError(res, 'Access denied.', 403);
    }
    logger.info('Workload entry retrieved', { id: req.params.id, userId: req.user.id });
    sendSuccess(res, toClient(doc), 200);
  } catch (err) { 
    logger.error('Error retrieving workload', { error: err.message, id: req.params.id, userId: req.user.id });
    next(err); 
  }
});

// POST /api/workloads  (admin)
router.post(
  '/',
  requireAuth, requireAdmin,
  validateWorkloadCreate,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Workload creation validation failed', { userId: req.user.id, errors: errors.array() });
        return sendValidationError(res, errors.array());
      }

          const { empId, courseId, year, section, manualL, manualT, manualP, capacityHours,
            facultyRole, allocationRow,
            empNameOverride, designationOverride, mobileOverride, courseNameOverride, courseTypeOverride } = req.body;

          const normalizedFacultyRole = FACULTY_ROLES.includes(String(facultyRole || '').trim())
            ? String(facultyRole).trim()
            : 'Main Faculty';

          // CRITICAL: Normalize year to canonical format (I/II/III/IV or M.Tech)
          const normalizedYear = normalizeYear(year);
          const normalizedSection = String(section || '').trim();


      const member = await Faculty.findOne({ empId: empId.trim() }).lean();
      if (!member && !empNameOverride) {
        logger.warn('Employee not found for workload creation', { empId, userId: req.user.id });
        return sendNotFound(res, 'Employee not found.');
      }
      const effectiveMember = member || {
        empId: empId.trim(),
        name:  empNameOverride || empId.trim(),
        mobile: String(mobileOverride || '').trim(),
        department: 'CSE',
        designation: designationOverride || 'Other',
      };

      const course = courseId > 0 ? await Course.findOne({ courseId: Number(courseId) }).lean() : null;
      if (!course && !courseNameOverride) {
        logger.warn('Course not found for workload creation', { courseId, userId: req.user.id });
        return sendNotFound(res, 'Course not found.');
      }
      const effectiveCourse = course || {
        courseId:    0,
        courseType:  courseTypeOverride || 'Other',
        subjectCode: 'OTHER',
        subjectName: courseNameOverride || 'Other Course',
        shortName:   (courseNameOverride || 'Other').substring(0, 12),
        program:     'Other',
        L: 0, T: 0, P: 0, C: 0,
      };

      // Backend validation for required fields (no nulls or missing)
      const requiredFields = [
        effectiveMember.empId, effectiveMember.name, effectiveMember.designation,
        effectiveCourse.courseType, effectiveCourse.subjectCode, effectiveCourse.subjectName, effectiveCourse.shortName, effectiveCourse.program,
        normalizedYear, normalizedSection
      ];
      if (requiredFields.some(f => f === undefined || f === null || f === '')) {
        logger.warn('Missing required field in workload assignment', { empId, courseId, userId: req.user.id });
        return sendError(res, 'Missing or null required field in workload assignment.', 400);
      }

      const sectionCheck = await ensureValidSection(normalizedYear, normalizedSection);
      if (!sectionCheck.ok) {
        logger.warn('Invalid section for workload', { year: normalizedYear, section: normalizedSection, userId: req.user.id });
        return sendError(res, sectionCheck.message, 400);
      }

      const courseTypeKey = normalizeCourseTypeKey(effectiveCourse.courseType);
      if (normalizedFacultyRole === 'Main Faculty' && courseTypeKey === 'DE' && isRestrictedDeYear(normalizedYear)) {
        const existingDe = await Workload.findOne(
          buildDeSectionConflictFilter({ year: normalizedYear, section: normalizedSection })
        ).lean();
        if (existingDe && existingDe.empId !== effectiveMember.empId) {
          logger.warn('Department Elective duplicate for section', { year: normalizedYear, section: normalizedSection, userId: req.user.id });
          return sendConflict(res, DE_SECTION_DUPLICATE_MSG);
        }
      }

      if (normalizedFacultyRole === 'Main Faculty') {
        const existingMain = await Workload.findOne({
          courseId: effectiveCourse.courseId,
          year: normalizedYear,
          section: normalizedSection,
          facultyRole: 'Main Faculty',
        }).lean();
        if (existingMain) {
          logger.warn('Main faculty already assigned', { courseId: effectiveCourse.courseId, year: normalizedYear, section: normalizedSection, userId: req.user.id });
          return sendConflict(res, MAIN_FACULTY_DUPLICATE_MSG);
        }
      }

      if (normalizedFacultyRole === 'TA') {
        const existingTa = await Workload.findOne({
          courseId: effectiveCourse.courseId,
          year: normalizedYear,
          section: normalizedSection,
          facultyRole: 'TA',
        }).lean();
        if (existingTa) {
          logger.warn('TA already assigned for section', { courseId: effectiveCourse.courseId, year: normalizedYear, section: normalizedSection, userId: req.user.id });
          return sendConflict(res, TA_SECTION_DUPLICATE_MSG);
        }
        const parsedRow = Number(allocationRow);
        if (!Number.isInteger(parsedRow) || parsedRow < 1 || parsedRow > 3) {
          logger.warn('Invalid allocation row for TA', { allocationRow, userId: req.user.id });
          return sendError(res, 'TA allocationRow must be 1, 2, or 3 (R2, R3, R4).', 400);
        }
      }

      // CRITICAL: Validate workload hours capacity
      const lectureHours = manualL ?? effectiveCourse.L;
      const tutorialHours = manualT ?? effectiveCourse.T;
      const practicalHours = manualP ?? effectiveCourse.P;
      const hoursToAssign = lectureHours + tutorialHours + practicalHours;

      try {
        const workloadCheck = await canAssignWorkload(effectiveMember.empId, lectureHours, tutorialHours, practicalHours);
        if (!workloadCheck.canAssign) {
          logger.warn('Faculty workload capacity exceeded', { 
            empId: effectiveMember.empId, 
            empName: effectiveMember.name,
            hoursToAssign,
            reason: workloadCheck.reason,
            userId: req.user.id 
          });
          return sendError(res, `Workload assignment failed: ${workloadCheck.reason}`, 400);
        }
        logger.info('Faculty workload capacity verified', {
          empId: effectiveMember.empId,
          empName: effectiveMember.name,
          hoursToAssign,
          summary: workloadCheck.summary,
          userId: req.user.id
        });
      } catch (hourErr) {
        logger.error('Error validating workload hours', { empId: effectiveMember.empId, error: hourErr.message, userId: req.user.id });
        return sendError(res, 'Error validating faculty capacity. Please contact support.', 500);
      }

      const duplicateRole = await Workload.findOne({
        empId: effectiveMember.empId,
        courseId: effectiveCourse.courseId,
        year: normalizedYear,
        section: normalizedSection,
        facultyRole: normalizedFacultyRole,
      }).lean();
      if (duplicateRole) {
        logger.warn('Duplicate role assignment', { empId: effectiveMember.empId, courseId: effectiveCourse.courseId, year: normalizedYear, section: normalizedSection, role: normalizedFacultyRole, userId: req.user.id });
        return sendConflict(res, ROLE_DUPLICATE_MSG);
      }

      const doc = await Workload.create({
        empId: effectiveMember.empId,
        empName: effectiveMember.name,
        facultyRole: normalizedFacultyRole,
        mobile: effectiveMember.mobile || '',
        department: effectiveMember.department || 'CSE',
        designation: effectiveMember.designation,
        courseId: effectiveCourse.courseId,
        courseType: effectiveCourse.courseType || 'Other',
        courseTypeKey,
        subjectCode: effectiveCourse.subjectCode,
        subjectName: effectiveCourse.subjectName, shortName: effectiveCourse.shortName, program: effectiveCourse.program,
        year: normalizedYear,
        section: normalizedSection,
        fixedL: effectiveCourse.L, fixedT: effectiveCourse.T, fixedP: effectiveCourse.P, C: effectiveCourse.C,
        manualL: manualL ?? effectiveCourse.L,
        manualT: manualT ?? effectiveCourse.T,
        manualP: manualP ?? effectiveCourse.P,
        capacityHours: Number(capacityHours) || 0,
        allocationRow: normalizedFacultyRole === 'TA' ? Number(allocationRow) : null,
      });

      if (normalizedFacultyRole === 'Main Faculty') {
        await syncMainFacultyToAllocation({
          courseId: doc.courseId,
          year: doc.year,
          section: doc.section,
          faculty: {
            empId: doc.empId,
            empName: doc.empName,
            designation: doc.designation,
          },
        });
      }

      if (normalizedFacultyRole === 'TA') {
        await syncTAToAllocation({
          courseId: doc.courseId,
          year: doc.year,
          section: doc.section,
          faculty: { empId: doc.empId, empName: doc.empName, designation: doc.designation },
          allocationRow: doc.allocationRow,
        });
      }

      await logAuditEvent({ req, action: 'workload.create', entity: 'workload', entityId: String(doc._id), metadata: { empId: doc.empId, courseId: doc.courseId, year: doc.year, section: doc.section } });
      logger.info('Workload created', { id: String(doc._id), empId: doc.empId, courseId: doc.courseId, year: doc.year, section: doc.section, userId: req.user.id });
      sendCreated(res, toClient(doc));
    } catch (err) {
      if (isTaUniqueIndexError(err)) {
        logger.error('TA unique index error', { error: err.message, userId: req.user.id });
        return sendConflict(res, TA_SECTION_DUPLICATE_MSG);
      }
      if (isDeUniqueIndexError(err)) {
        logger.error('DE unique index error', { error: err.message, userId: req.user.id });
        return sendConflict(res, DE_SECTION_DUPLICATE_MSG);
      }
      if (isDuplicateKeyError(err)) {
        logger.error('Duplicate key error', { error: err.message, userId: req.user.id });
        return sendConflict(res, MAIN_FACULTY_DUPLICATE_MSG);
      }
      logger.error('Error creating workload', { error: err.message, userId: req.user.id });
      next(err);
    }
  }
);

// PUT /api/workloads/:id  (admin)
router.put('/:id', requireAuth, requireAdmin, validateWorkloadUpdate, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Workload update validation failed', { id: req.params.id, userId: req.user.id, errors: errors.array() });
      return sendValidationError(res, errors.array());
    }

    const current = await Workload.findById(req.params.id).lean();
    if (!current) {
      logger.warn('Workload entry not found for update', { id: req.params.id, userId: req.user.id });
      return sendNotFound(res, 'Workload entry not found.');
    }

    const updates = { ...req.body };
    const {
      empNameOverride,
      designationOverride,
      mobileOverride,
      courseNameOverride,
      courseTypeOverride,
      facultyRole,
    } = updates;

    const normalizedFacultyRole = FACULTY_ROLES.includes(String(facultyRole || '').trim())
      ? String(facultyRole).trim()
      : String(current.facultyRole || 'Main Faculty');

    const nextCourseId = Number(updates.courseId ?? current.courseId);
    const nextYear = String(updates.year ?? current.year).trim();
    const nextSection = String(updates.section ?? current.section).trim();

    const sectionCheck = await ensureValidSection(nextYear, nextSection);
    if (!sectionCheck.ok) {
      logger.warn('Invalid section in workload update', { id: req.params.id, year: nextYear, section: nextSection, userId: req.user.id });
      return sendError(res, sectionCheck.message, 400);
    }

    const nextEmpId = String(updates.empId ?? current.empId).trim();
    const member = await Faculty.findOne({ empId: nextEmpId }).lean();
    const effectiveMember = member
      ? {
        empId: member.empId,
        name: member.name,
        mobile: member.mobile || '',
        department: member.department || 'CSE',
        designation: member.designation,
      }
      : {
        empId: nextEmpId,
        name: String(empNameOverride || current.empName || nextEmpId).trim(),
        mobile: String(mobileOverride || current.mobile || '').trim(),
        department: String(current.department || 'CSE').trim() || 'CSE',
        designation: String(designationOverride || current.designation || 'Other').trim() || 'Other',
      };

    if (!effectiveMember.name) {
      logger.warn('Employee not found in workload update', { empId: nextEmpId, userId: req.user.id });
      return sendNotFound(res, 'Employee not found.');
    }

    const course = await Course.findOne({ courseId: nextCourseId }).lean();
    const effectiveCourse = course
      ? {
        courseId: course.courseId,
        courseType: course.courseType || 'Other',
        subjectCode: course.subjectCode,
        subjectName: course.subjectName,
        shortName: course.shortName,
        program: course.program,
        L: course.L,
        T: course.T,
        P: course.P,
        C: course.C,
      }
      : {
        courseId: 0,
        courseType: String(courseTypeOverride || current.courseType || 'Other').trim() || 'Other',
        subjectCode: String(current.subjectCode || 'OTHER').trim() || 'OTHER',
        subjectName: String(courseNameOverride || current.subjectName || 'Other Course').trim() || 'Other Course',
        shortName: String(current.shortName || (courseNameOverride || 'Other').substring(0, 12)).trim() || 'Other',
        program: String(current.program || 'Other').trim() || 'Other',
        L: Number(current.fixedL || 0),
        T: Number(current.fixedT || 0),
        P: Number(current.fixedP || 0),
        C: Number(current.C || 0),
      };

    if (!course && !courseNameOverride && nextCourseId > 0) {
      logger.warn('Course not found in workload update', { courseId: nextCourseId, userId: req.user.id });
      return sendNotFound(res, 'Course not found.');
    }

    if (normalizedFacultyRole === 'Main Faculty') {
      const duplicateMain = await Workload.findOne({
        _id: { $ne: req.params.id },
        courseId: effectiveCourse.courseId,
        year: nextYear,
        section: nextSection,
        facultyRole: 'Main Faculty',
      }).lean();
      if (duplicateMain) {
        logger.warn('Main faculty duplicate in update', { id: req.params.id, courseId: effectiveCourse.courseId, year: nextYear, section: nextSection, userId: req.user.id });
        return sendConflict(res, MAIN_FACULTY_DUPLICATE_MSG);
      }
    }

    if (normalizedFacultyRole === 'TA') {
      const duplicateTa = await Workload.findOne({
        _id: { $ne: req.params.id },
        courseId: effectiveCourse.courseId,
        year: nextYear,
        section: nextSection,
        facultyRole: 'TA',
      }).lean();
      if (duplicateTa) {
        logger.warn('TA duplicate in update', { id: req.params.id, courseId: effectiveCourse.courseId, year: nextYear, section: nextSection, userId: req.user.id });
        return sendConflict(res, TA_SECTION_DUPLICATE_MSG);
      }
    }

    const duplicateRole = await Workload.findOne({
      _id: { $ne: req.params.id },
      empId: effectiveMember.empId,
      courseId: effectiveCourse.courseId,
      year: nextYear,
      section: nextSection,
      facultyRole: normalizedFacultyRole,
    }).lean();

    if (duplicateRole) {
      logger.warn('Duplicate role in update', { id: req.params.id, empId: effectiveMember.empId, courseId: effectiveCourse.courseId, year: nextYear, section: nextSection, role: normalizedFacultyRole, userId: req.user.id });
      return sendConflict(res, ROLE_DUPLICATE_MSG);
    }

    const nextAllocationRow = (() => {
      if (normalizedFacultyRole !== 'TA') return null;
      const parsed = Number(updates.allocationRow);
      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 3) return parsed;
      return Number(current.allocationRow) || 1;
    })();

    const safeUpdates = {
      empId: effectiveMember.empId,
      empName: effectiveMember.name,
      facultyRole: normalizedFacultyRole,
      mobile: effectiveMember.mobile || '',
      department: effectiveMember.department || 'CSE',
      designation: effectiveMember.designation,
      courseId: effectiveCourse.courseId,
      courseType: effectiveCourse.courseType || 'Other',
      courseTypeKey: normalizeCourseTypeKey(effectiveCourse.courseType || 'Other'),
      subjectCode: effectiveCourse.subjectCode,
      subjectName: effectiveCourse.subjectName,
      shortName: effectiveCourse.shortName,
      program: effectiveCourse.program,
      year: nextYear,
      section: nextSection,
      fixedL: effectiveCourse.L,
      fixedT: effectiveCourse.T,
      fixedP: effectiveCourse.P,
      C: effectiveCourse.C,
      manualL: Number(updates.manualL ?? current.manualL ?? effectiveCourse.L ?? 0),
      manualT: Number(updates.manualT ?? current.manualT ?? effectiveCourse.T ?? 0),
      manualP: Number(updates.manualP ?? current.manualP ?? effectiveCourse.P ?? 0),
      capacityHours: Number(updates.capacityHours ?? current.capacityHours ?? 0),
      allocationRow: nextAllocationRow,
    };

    if (normalizedFacultyRole === 'Main Faculty' && safeUpdates.courseTypeKey === 'DE' && isRestrictedDeYear(nextYear)) {
      const existingDe = await Workload.findOne(
        buildDeSectionConflictFilter({ year: nextYear, section: nextSection, excludeId: req.params.id })
      ).lean();
      if (existingDe && existingDe.empId !== effectiveMember.empId) {
        logger.warn('DE constraint violation in update', { id: req.params.id, year: nextYear, section: nextSection, userId: req.user.id });
        return sendConflict(res, DE_SECTION_DUPLICATE_MSG);
      }
    }

    const doc = await Workload.findByIdAndUpdate(req.params.id, { $set: safeUpdates }, { new: true }).lean();
    if (!doc) {
      logger.warn('Workload not found after update', { id: req.params.id, userId: req.user.id });
      return sendNotFound(res, 'Workload entry not found.');
    }

    const wasMainFaculty = String(current.facultyRole || 'Main Faculty') === 'Main Faculty';
    const isMainFaculty = String(doc.facultyRole || 'Main Faculty') === 'Main Faculty';

    if (wasMainFaculty) {
      const movedOrChanged =
        String(current.empId || '') !== String(doc.empId || '') ||
        Number(current.courseId || 0) !== Number(doc.courseId || 0) ||
        String(current.year || '') !== String(doc.year || '') ||
        String(current.section || '') !== String(doc.section || '') ||
        !isMainFaculty;

      if (movedOrChanged) {
        await clearMainFacultyFromAllocation({
          courseId: current.courseId,
          year: current.year,
          section: current.section,
          empId: current.empId,
        });
      }
    }

    if (isMainFaculty) {
      await syncMainFacultyToAllocation({
        courseId: doc.courseId,
        year: doc.year,
        section: doc.section,
        faculty: {
          empId: doc.empId,
          empName: doc.empName,
          designation: doc.designation,
        },
      });
    }

    const wasTA = String(current.facultyRole || 'Main Faculty') === 'TA';
    const isTA = String(doc.facultyRole || 'Main Faculty') === 'TA';

    if (wasTA && current.allocationRow) {
      // Clear old TA slot if course/year/section/row changed, or role changed away from TA
      const taChanged =
        Number(current.courseId || 0) !== Number(doc.courseId || 0) ||
        String(current.year || '') !== String(doc.year || '') ||
        String(current.section || '') !== String(doc.section || '') ||
        Number(current.allocationRow || 0) !== Number(doc.allocationRow || 0) ||
        !isTA;
      if (taChanged) {
        await clearTAFromAllocation({
          courseId: current.courseId,
          year: current.year,
          section: current.section,
          allocationRow: current.allocationRow,
        });
      }
    }

    if (isTA && doc.allocationRow) {
      await syncTAToAllocation({
        courseId: doc.courseId,
        year: doc.year,
        section: doc.section,
        faculty: { empId: doc.empId, empName: doc.empName, designation: doc.designation },
        allocationRow: doc.allocationRow,
      });
    }

    await logAuditEvent({ req, action: 'workload.update', entity: 'workload', entityId: String(req.params.id), metadata: { empId: doc.empId, courseId: doc.courseId, year: doc.year, section: doc.section } });
    logger.info('Workload updated', { id: req.params.id, empId: doc.empId, courseId: doc.courseId, year: doc.year, section: doc.section, userId: req.user.id });
    sendSuccess(res, toClient(doc), 200);
  } catch (err) {
    if (isTaUniqueIndexError(err)) {
      logger.error('TA unique index error in update', { error: err.message, id: req.params.id, userId: req.user.id });
      return sendConflict(res, TA_SECTION_DUPLICATE_MSG);
    }
    if (isDeUniqueIndexError(err)) {
      logger.error('DE unique index error in update', { error: err.message, id: req.params.id, userId: req.user.id });
      return sendConflict(res, DE_SECTION_DUPLICATE_MSG);
    }
    if (isDuplicateKeyError(err)) {
      logger.error('Duplicate key error in update', { error: err.message, id: req.params.id, userId: req.user.id });
      return sendConflict(res, MAIN_FACULTY_DUPLICATE_MSG);
    }
    logger.error('Error updating workload', { error: err.message, id: req.params.id, userId: req.user.id });
    next(err);
  }
});

// DELETE /api/workloads/:id  (admin)
router.delete('/:id', requireAuth, requireAdmin, validateWorkloadDelete, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Workload deletion validation failed', { id: req.params.id, userId: req.user.id, errors: errors.array() });
      return sendValidationError(res, errors.array());
    }

    const doc = await Workload.findByIdAndDelete(req.params.id);
    if (!doc) {
      logger.warn('Workload entry not found for deletion', { id: req.params.id, userId: req.user.id });
      return sendNotFound(res, 'Workload entry not found.');
    }

    if (String(doc.facultyRole || 'Main Faculty') === 'Main Faculty') {
      await clearMainFacultyFromAllocation({
        courseId: doc.courseId,
        year: doc.year,
        section: doc.section,
        empId: doc.empId,
      });
    }

    if (String(doc.facultyRole || '') === 'TA' && doc.allocationRow) {
      await clearTAFromAllocation({
        courseId: doc.courseId,
        year: doc.year,
        section: doc.section,
        allocationRow: doc.allocationRow,
      });
    }

    await logAuditEvent({ req, action: 'workload.delete', entity: 'workload', entityId: String(req.params.id), metadata: { empId: doc.empId, courseId: doc.courseId, year: doc.year, section: doc.section } });
    logger.info('Workload deleted', { id: req.params.id, empId: doc.empId, courseId: doc.courseId, year: doc.year, section: doc.section, userId: req.user.id });
    sendSuccess(res, { message: 'Workload entry deleted.' }, 200);
  } catch (err) { 
    logger.error('Error deleting workload', { error: err.message, id: req.params.id, userId: req.user.id });
    next(err); 
  }
});

// GET /api/workloads/faculty-hours/:empId (admin/faculty)
// Get faculty workload summary with remaining hours capacity
router.get('/faculty-hours/:empId', requireAuth, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { empId } = req.params;
    const isDualAccessAdmin = req.user?.canAccessAdmin === true;
    const isFacultyOnly = req.user.role === 'faculty' && !isDualAccessAdmin;

    // Faculty can only see their own hours; admin can see any
    if (isFacultyOnly && String(req.user.id) !== String(empId)) {
      logger.warn('Unauthorized attempt to access faculty hours', { empId, userId: req.user.id });
      return sendError(res, 'Unauthorized. You can only view your own workload.', 403);
    }

    const summary = await getFacultyWorkloadSummary(empId);
    logger.info('Faculty workload summary retrieved', { empId, summary: { currentLoad: summary.currentLoad, totalCapacity: summary.totalWorkingHours, utilizationPercent: summary.utilizationPercent }, userId: req.user.id });
    sendSuccess(res, { data: summary }, 200);
  } catch (err) {
    if (err.message.includes('Faculty not found')) {
      logger.warn('Faculty not found for hours check', { empId: req.params.empId, userId: req.user.id });
      return sendNotFound(res, err.message);
    }
    logger.error('Error retrieving faculty workload hours', { empId: req.params.empId, error: err.message, userId: req.user.id });
    next(err);
  }
});

// GET /api/workloads/workload-report (admin only)
// Get workload report for all faculty, optionally filtered by year
router.get('/workload-report', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { year } = req.query;
    const yearFilter = year ? normalizeYear(year) : null;

    const report = await getFacultyWorkloadReport(yearFilter);
    const summary = {
      totalFaculty: report.length,
      overAllocatedCount: report.filter(f => f.isOverAllocated).length,
      averageUtilization: (report.reduce((sum, f) => sum + f.utilizationPercent, 0) / report.length).toFixed(2),
      yearFilter: yearFilter || 'all_years'
    };

    logger.info('Workload report generated', { summary, userId: req.user.id });
    sendSuccess(res, { data: report, summary }, 200);
  } catch (err) {
    logger.error('Error generating workload report', { error: err.message, userId: req.user.id });
    next(err);
  }
});

/**
 * PUT /api/workloads/:id/periods
 * Update workload periods (L/T/P hours) with validation for capacity
 * Allows admin to fix faculty workload hours
 * Admin only
 */
router.put('/:id/periods', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { manualL, manualT, manualP } = req.body;

    // Validate input
    const newL = Number(manualL);
    const newT = Number(manualT);
    const newP = Number(manualP);

    if (isNaN(newL) || isNaN(newT) || isNaN(newP)) {
      logger.warn('Invalid period values in update', { id, manualL, manualT, manualP, userId: req.user.id });
      return sendError(res, 'Invalid period values. L, T, P must be numbers.', 400);
    }

    if (newL < 0 || newT < 0 || newP < 0) {
      logger.warn('Negative period values in update', { id, manualL, manualT, manualP, userId: req.user.id });
      return sendError(res, 'Period values cannot be negative.', 400);
    }

    const workload = await Workload.findById(id).lean();
    if (!workload) {
      logger.warn('Workload not found for period update', { id, userId: req.user.id });
      return sendNotFound(res, 'Workload entry not found.');
    }

    const faculty = await Faculty.findOne({ empId: workload.empId }).lean();
    if (!faculty) {
      logger.warn('Faculty not found for period update validation', { empId: workload.empId, userId: req.user.id });
      return sendNotFound(res, 'Faculty not found.');
    }

    const totalCapacity = Number(faculty.totalWorkingHours || 24);
    
    // Get current total hours excluding this workload
    const otherWorkloads = await Workload.find({ 
      empId: workload.empId, 
      _id: { $ne: id } 
    }).lean();

    let currentTotalHours = 0;
    otherWorkloads.forEach(w => {
      const L = Number(w.manualL || w.fixedL || 0);
      const T = Number(w.manualT || w.fixedT || 0);
      const P = Number(w.manualP || w.fixedP || 0);
      currentTotalHours += (L + T + P);
    });

    const newWorkloadHours = newL + newT + newP;
    const updatedTotal = currentTotalHours + newWorkloadHours;
    const excessHours = updatedTotal > totalCapacity ? updatedTotal - totalCapacity : 0;

    const result = await Workload.findByIdAndUpdate(
      id,
      {
        $set: {
          manualL: newL,
          manualT: newT,
          manualP: newP,
        }
      },
      { new: true }
    ).lean();

    await logAuditEvent({
      req,
      action: 'workload.periods.update',
      entity: 'workload',
      entityId: id,
      metadata: {
        empId: workload.empId,
        previousL: workload.manualL || workload.fixedL,
        previousT: workload.manualT || workload.fixedT,
        previousP: workload.manualP || workload.fixedP,
        newL,
        newT,
        newP,
        isOverAllocated: updatedTotal > totalCapacity,
        excessHours,
        totalCapacity,
      }
    });

    logger.info('Workload periods updated', {
      id,
      empId: workload.empId,
      newL,
      newT,
      newP,
      updatedTotal,
      totalCapacity,
      excessHours,
      userId: req.user.id
    });

    sendSuccess(res, {
      ...toClient(result),
      capacityInfo: {
        totalCapacity,
        currentTotalHours: updatedTotal,
        remainingHours: Math.max(0, totalCapacity - updatedTotal),
        excessHours,
        isOverAllocated: updatedTotal > totalCapacity,
      }
    }, 200);
  } catch (err) {
    logger.error('Error updating workload periods', { error: err.message, id: req.params.id, userId: req.user.id });
    next(err);
  }
});

/**
 * PATCH /deva/workloads/faculty/:empId/capacity
 * Update capacity hours for all workloads of a specific faculty
 */
router.patch('/faculty/:empId/capacity', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { empId } = req.params;
    const { capacityHours } = req.body;

    // Validate input
    if (capacityHours === undefined || capacityHours === null) {
      logger.warn('Missing capacityHours in request', { empId, userId: req.user.id });
      return sendError(res, 'capacityHours is required.', 400);
    }

    const newCapacity = Number(capacityHours);
    if (isNaN(newCapacity) || newCapacity <= 0) {
      logger.warn('Invalid capacityHours value', { empId, capacityHours, userId: req.user.id });
      return sendError(res, 'capacityHours must be a positive number.', 400);
    }

    // Update all workloads for this faculty with new capacity
    const result = await Workload.updateMany(
      { empId },
      { $set: { capacityHours: newCapacity } }
    );

    if (result.matchedCount === 0) {
      logger.warn('No workloads found for faculty capacity update', { empId, userId: req.user.id });
      return sendNotFound(res, 'No workloads found for this faculty.');
    }

    logger.info('Faculty capacity updated', {
      empId,
      capacityHours: newCapacity,
      modifiedCount: result.modifiedCount,
      userId: req.user.id,
    });

    sendSuccess(res, {
      message: `Capacity updated to ${newCapacity}h for ${result.modifiedCount} workload(s).`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    logger.error('Error updating faculty capacity', { error: err.message, userId: req.user.id });
    sendServerError(res, 'Failed to update capacity.');
  }
});

/**
/**
 * PATCH /deva/workloads/faculty-visibility/:empId
 * Toggle visibility for ALL workloads of a specific faculty
 * MUST BE BEFORE /:id/visibility route to match correctly
 */
router.patch('/faculty-visibility/:empId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { empId } = req.params;
    const { isVisible } = req.body;

    // Validate input
    if (isVisible === undefined || isVisible === null) {
      logger.warn('Missing isVisible in request', { empId, userId: req.user.id });
      return sendError(res, 'isVisible is required (true/false).', 400);
    }

    const boolIsVisible = Boolean(isVisible);

    // Update all workloads for this faculty
    const result = await Workload.updateMany(
      { empId },
      { $set: { isVisible: boolIsVisible } }
    );

    if (result.matchedCount === 0) {
      logger.warn('No workloads found for faculty visibility toggle', { empId, userId: req.user.id });
      return sendNotFound(res, 'No workloads found for this faculty.');
    }

    logger.info('Faculty workloads visibility toggled', {
      empId,
      isVisible: boolIsVisible,
      modifiedCount: result.modifiedCount,
      userId: req.user.id,
    });

    sendSuccess(res, {
      message: `All workloads for ${empId} are now ${boolIsVisible ? 'visible' : 'hidden'}.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    logger.error('Error toggling faculty workloads visibility', { error: err.message, userId: req.user.id });
    sendServerError(res, 'Failed to toggle visibility.');
  }
});

/**
 * PATCH /deva/workloads/:id/visibility
 * Toggle visibility status of a specific workload
 */
router.patch('/:id/visibility', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isVisible } = req.body;

    // Validate input
    if (isVisible === undefined || isVisible === null) {
      logger.warn('Missing isVisible in request', { id, userId: req.user.id });
      return sendError(res, 'isVisible is required (true/false).', 400);
    }

    const boolIsVisible = Boolean(isVisible);

    // Update workload visibility
    const result = await Workload.findByIdAndUpdate(
      id,
      { $set: { isVisible: boolIsVisible } },
      { new: true }
    );

    if (!result) {
      logger.warn('Workload not found for visibility toggle', { id, userId: req.user.id });
      return sendNotFound(res, 'Workload not found.');
    }

    logger.info('Workload visibility toggled', {
      id,
      isVisible: boolIsVisible,
      empId: result.empId,
      subjectCode: result.subjectCode,
      userId: req.user.id,
    });

    sendSuccess(res, {
      message: `Workload visibility ${boolIsVisible ? 'enabled' : 'disabled'}.`,
      data: {
        _id: result._id,
        isVisible: result.isVisible,
      },
    });
  } catch (err) {
    logger.error('Error toggling workload visibility', { error: err.message, userId: req.user.id });
    sendServerError(res, 'Failed to toggle visibility.');
  }
});

module.exports = router;

