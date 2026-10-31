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
const mongoose  = require('mongoose');
const Workload  = require('../models/Workload');
const Faculty   = require('../models/Faculty');
const Course    = require('../models/Course');
const CourseAllocation = require('../models/CourseAllocation');
const Setting   = require('../models/Setting');
const Designation = require('../models/Designation');
const FacultyCapacity = require('../models/FacultyCapacity');
const { parsePagination, buildMeta } = require('../utils/pagination');

const { requireAuth, requireAdmin } = require('../middleware/auth');
const requireAcademicPeriod = require('../middleware/academicPeriod');
const { sendSuccess, sendError, sendValidationError, sendPaginated, sendCreated, sendConflict, sendNotFound } = require('../utils/response');
const logger = require('../utils/logger');
const { validateWorkloadCreate, validateWorkloadUpdate, validateWorkloadDelete, validatePagination } = require('../middleware/validators');
const { normalizeCourseTypeKey, normalizeYear, deriveYearFromCode, resolveCourseYear } = require('../utils/courseUtils');
const { calculateFacultyWorkload, getFacultyWorkloadSummary, canAssignWorkload, getFacultyWorkloadReport } = require('../utils/workloadHours');
const { recalculateCapacity } = require('../utils/capacityUtils');
const { isTADesignation, isTaDesignationAsync, getDefaultCapacity } = require('../utils/designationUtils');
const { reconcileAllAllocationsToWorkload } = require('../utils/allocationWorkloadSync');
const { ADMIN_EMPLOYEE_IDS } = require('../config/adminConfig');
const { buildFacultyDateFilter } = require('../utils/academicPeriodUtils');
const wsHandler = require('../websocket');

const router = express.Router();

const EXACT_DUPLICATE_MSG = 'Workload already assigned. This course is already allocated for the selected section and academic context.';

// C-4 FIX: Define FACULTY_ROLES constant (was referenced but never declared, causing ReferenceError)
const FACULTY_ROLES = ['Main Faculty', 'Supporting Faculty', 'TA'];

const MAIN_FACULTY_DUPLICATE_MSG = EXACT_DUPLICATE_MSG;
const ROLE_DUPLICATE_MSG = EXACT_DUPLICATE_MSG;
const TA_SECTION_DUPLICATE_MSG = EXACT_DUPLICATE_MSG;
const DE_SECTION_DUPLICATE_MSG = EXACT_DUPLICATE_MSG;
const DE_COURSE_TYPE_REGEX = /^\s*(de|department\s+elective)\s*$/i;

// CRITICAL: Normalize year format (numeric or Roman numeral) to canonical form
const _legacyNormalizeYear = (year) => {
  const trimmed = String(year || '').trim();
  const upper = trimmed.toUpperCase();
  if (upper === 'I' || upper === '1') return 'I';
  if (upper === 'II' || upper === '2') return 'II';
  if (upper === 'III' || upper === '3') return 'III';
  if (upper === 'IV' || upper === '4') return 'IV';
  if (upper === 'V' || upper === '5') return 'V';
  if (upper === 'VI' || upper === '6') return 'VI';
  if (upper === 'M.TECH_I' || upper === 'MTECH_I' || upper === 'M.TECH-I' || upper === 'MTECH I') return 'M.Tech_I';
  if (upper === 'M.TECH_II' || upper === 'MTECH_II' || upper === 'M.TECH-II' || upper === 'MTECH II') return 'M.Tech_II';
  return trimmed;
};

const isDuplicateKeyError = (err) =>
  !!err && (
    err.code === 11000 ||
    err.code === 11001 ||
    err.errorResponse?.code === 11000 ||
    err.errorResponse?.code === 11001 ||
    String(err.message || '').includes('E11000') ||
    String(err.message || '').includes('duplicate key')
  );

const isWriteConflictError = (err) =>
  !!err && (
    err.code === 112 ||
    err.errorResponse?.code === 112 ||
    String(err.message || '').includes('WriteConflict') ||
    (typeof err.hasErrorLabel === 'function' && err.hasErrorLabel('TransientTransactionError'))
  );

// L-3 FIX: normalizeCourseTypeKey removed (now imported from courseUtils)

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

const buildDeSectionConflictFilter = ({ year, section, excludeId, academicYear, semester, program }) => {
  const filter = {
    year: String(year || '').trim(),
    section: String(section || '').trim(),
    facultyRole: 'Main Faculty',
    allocationStatus: 'ALLOCATED',
    empId: { $ne: '' },
    $or: [
      { courseTypeKey: 'DE' },
      { courseType: { $regex: DE_COURSE_TYPE_REGEX } },
    ],
  };

  if (academicYear) filter.academicYear = String(academicYear).trim();
  if (semester) filter.semester = String(semester).trim();
  if (program) filter.program = String(program).trim();
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  return filter;
};

const sec = (n) => Array.from({ length: n }, (_, i) => String(i + 1));
const DEFAULT_SECTIONS = {
  I: sec(19), II: sec(22), III: sec(19), IV: [...sec(19), ...Array.from({ length: 9 }, (_, i) => String(51 + i))],
  'M.Tech_I': ['1'],
  'M.Tech_II': ['1']
};

const getSectionsConfig = async (academicYear, semester) => {
  let doc = null;
  const sem = String(semester || '').toUpperCase().trim();
  const yr = String(academicYear || '').trim();

  if (yr && sem) {
    doc = await Setting.findOne({ key: `sections_config_${yr}_${sem}` }).lean();
  }
  // Strict period isolation: never cross-pollinate between ODD and EVEN semesters
  if (!doc && yr) {
    doc = await Setting.findOne({ key: `sections_config_${yr}` }).lean();
  }
  if (!doc) {
    doc = await Setting.findOne({ key: 'sections_config' }).lean();
  }
  if (!doc?.value) return DEFAULT_SECTIONS;
  try {
    const parsed = JSON.parse(doc.value);
    return { ...DEFAULT_SECTIONS, ...(parsed || {}) };
  } catch {
    return DEFAULT_SECTIONS;
  }
};

const ensureValidSection = async (year, section, acYear, sem) => {
  const cfg = await getSectionsConfig(acYear, sem);
  if (!cfg[year]) return { ok: true };
  if (!cfg[year].includes(section)) {
    return { ok: false, message: `Invalid section '${section}' for year '${year}'.` };
  }
  return { ok: true };
};

const toClient = (doc) => ({
  id:          doc._id?.toString() || '',
  empId:       String(doc.faculty?.empId || doc.empId || '').trim(),
  empName:     String(doc.faculty?.name || doc.empName || '').trim(),
  facultyRole: String(doc.facultyRole || 'Main Faculty').trim(),
  designation: String(doc.faculty?.designation || doc.designation || '').trim() || 'N/A',
  mobile:      String(doc.faculty?.mobile || doc.mobile || '').trim() || 'N/A',
  department:  String(doc.faculty?.department || doc.department || '').trim() || 'CSE',
  courseId:    Number(doc.course?.courseId || doc.courseId || 0),
  courseType:  String(doc.course?.courseType || doc.courseType || '').trim() || 'Other',
  subjectCode: String(doc.course?.subjectCode || doc.subjectCode || '').trim(),
  subjectName: String(doc.course?.subjectName || doc.subjectName || '').trim(),
  shortName:   String(doc.course?.shortName || doc.shortName || '').trim(),
  program:     String(doc.course?.program || doc.program || '').trim() || 'N/A',
  year:        String(doc.sectionRef?.year || doc.year || '').trim() || 'I',
  section:     String(doc.sectionRef?.name || doc.section || '').trim() || '1',
  fixedL:      Number(doc.course?.L ?? doc.fixedL ?? 0),
  fixedT:      Number(doc.course?.T ?? doc.fixedT ?? 0),
  fixedP:      Number(doc.course?.P ?? doc.fixedP ?? 0),
  C:           Number(doc.course?.C ?? doc.C ?? 0),
  manualL:     Number(doc.manualL || 0),
  manualT:     Number(doc.manualT || 0),
  manualP:     Number(doc.manualP || 0),
  isVisible:   doc.isVisible === true,
  allocationRow: doc.allocationRow ?? null,
  semester:    doc.semester || '',
  academicYear: doc.academicYear || '',
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

const syncMainFacultyToAllocation = async ({ courseId, year, section, faculty, academicYear, semester }, session = null) => {
  const numericCourseId = Number(courseId || 0);
  if (!numericCourseId || !year || !section || !faculty?.empId) return;

  const courseQuery = Course.findOne({ courseId: numericCourseId }).lean();
  if (session) courseQuery.session(session);
  const course = await courseQuery.exec();
  if (!course) return;

  const query = { courseId: numericCourseId, year, section };
  if (academicYear) query.academicYear = String(academicYear).trim();
  if (semester) query.semester = String(semester).trim();

  const existingQuery = CourseAllocation.findOne(query).lean();
  if (session) existingQuery.session(session);
  const existing = await existingQuery.exec();

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

  const setObj = {
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
  };
  if (academicYear) setObj.academicYear = String(academicYear).trim();
  if (semester) setObj.semester = String(semester).trim();

  await CourseAllocation.findOneAndUpdate(
    query,
    { $set: setObj },
    { upsert: true, new: true, ...(session && { session }) }
  );
};

const clearMainFacultyFromAllocation = async ({ courseId, year, section, empId, academicYear, semester }, session = null) => {
  const numericCourseId = Number(courseId || 0);
  if (!numericCourseId || !year || !section || !empId) return;

  const query = { courseId: numericCourseId, year, section };
  if (academicYear) query.academicYear = String(academicYear).trim();
  if (semester) query.semester = String(semester).trim();

  const existingQuery = CourseAllocation.findOne(query).lean();
  if (session) existingQuery.session(session);
  const existing = await existingQuery.exec();
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
    query,
    {
      $set: {
        lectureSlots,
        lectureSlot: lectureSlots[0] || {},
        tutorialSlots,
        practicalSlots,
      },
    },
    { new: true, ...(session && { session }) }
  );
};

// Sync a TA workload assignment to the allocation at the specified row index (1-3)
const syncTAToAllocation = async ({ courseId, year, section, faculty, allocationRow, academicYear, semester }, session = null) => {
  const numericCourseId = Number(courseId || 0);
  const rowIdx = Number(allocationRow || 0);
  if (!numericCourseId || !year || !section || !faculty?.empId || rowIdx < 1 || rowIdx > 3) return;

  const courseQuery = Course.findOne({ courseId: numericCourseId }).lean();
  if (session) courseQuery.session(session);
  const course = await courseQuery.exec();
  if (!course) return;

  const taSlot = toPrimarySlot(faculty, 0);

  const query = { courseId: numericCourseId, year, section };
  if (academicYear) query.academicYear = String(academicYear).trim();
  if (semester) query.semester = String(semester).trim();

  const existingQuery = CourseAllocation.findOne(query).lean();
  if (session) existingQuery.session(session);
  const existing = await existingQuery.exec();

  const tutorialSlots = normalizeSlots(existing?.tutorialSlots);
  const practicalSlots = normalizeSlots(existing?.practicalSlots);
  if (course.T > 0) tutorialSlots[rowIdx] = taSlot;
  if (course.P > 0) practicalSlots[rowIdx] = taSlot;

  const setObj = {
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
  };
  if (academicYear) setObj.academicYear = String(academicYear).trim();
  if (semester) setObj.semester = String(semester).trim();

  await CourseAllocation.findOneAndUpdate(
    query,
    { $set: setObj },
    { upsert: true, new: true, ...(session && { session }) }
  );
};

// Clear a TA from the allocation at the specified row index
const clearTAFromAllocation = async ({ courseId, year, section, allocationRow, academicYear, semester }, session = null) => {
  const numericCourseId = Number(courseId || 0);
  const rowIdx = Number(allocationRow || 0);
  if (!numericCourseId || !year || !section || rowIdx < 1 || rowIdx > 3) return;

  const query = { courseId: numericCourseId, year, section };
  if (academicYear) query.academicYear = String(academicYear).trim();
  if (semester) query.semester = String(semester).trim();

  const existingQuery = CourseAllocation.findOne(query).lean();
  if (session) existingQuery.session(session);
  const existing = await existingQuery.exec();
  if (!existing) return;

  const tutorialSlots = normalizeSlots(existing.tutorialSlots);
  const practicalSlots = normalizeSlots(existing.practicalSlots);
  tutorialSlots[rowIdx] = emptyFacultySlot();
  practicalSlots[rowIdx] = emptyFacultySlot();

  await CourseAllocation.findOneAndUpdate(
    query,
    { $set: { tutorialSlots, practicalSlots } },
    { new: true, ...(session && { session }) }
  );
};

// GET /api/workloads
// List workloads with filtering. Properly returns ALL records matching the filter (uses find(), NOT findOne())
router.get('/', requireAuth, requireAcademicPeriod, validatePagination, async (req, res, next) => {
  try {
    // Disable caching to prevent 304 Not Modified responses
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    // Automatically reconcile allocations from CourseAllocation into Workload (throttled)
    const semType = req.academicPeriod?.academicYearSemester?.semesterType || req.query.semester;
    const yearName = req.academicPeriod?.academicYear?.name || req.query.academicYear;
    await reconcileAllAllocationsToWorkload({ semester: semType, academicYear: yearName });

    const { page, limit, skip } = parsePagination(req.query);
    // L-1/M-4: Always exclude soft-deleted workloads
    const filter = { 
      isDeleted: { $ne: true },
      allocationStatus: { $nin: ['CANCELLED', 'UNALLOCATED'] }
    };
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

    const periodFilter = req.getPeriodFilter();
    const andClauses = [];
    if (periodFilter && Object.keys(periodFilter).length > 0) {
      andClauses.push(periodFilter);
    }
    if (req.query.search) {
      const q = String(req.query.search).trim().replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
      andClauses.push({
        $or: [
          { empId:       { $regex: q, $options: 'i' } },
          { empName:     { $regex: q, $options: 'i' } },
          { subjectCode: { $regex: q, $options: 'i' } },
          { subjectName: { $regex: q, $options: 'i' } },
        ]
      });
    }
    if (andClauses.length > 0) {
      filter.$and = andClauses;
    }
    
    // CRITICAL: Always use find() to get ALL matching records, never findOne()
    // This ensures multiple faculty workloads in the same section are returned
    const [total, docs] = await Promise.all([
      Workload.countDocuments(filter),
      Workload.find(filter)
        .select('faculty course sectionRef empId empName facultyRole designation mobile department courseId courseType subjectCode subjectName shortName program year section fixedL fixedT fixedP C manualL manualT manualP isVisible allocationRow allocationStatus semester academicYear createdAt')
        .sort({ year: 1, section: 1, subjectCode: 1, createdAt: -1, _id: 1 })
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
router.get('/export/csv', requireAuth, requireAdmin, requireAcademicPeriod, async (req, res, next) => {
  try {
    // L-8/M-4: Exclude soft-deleted and cancelled/unallocated workloads from CSV export
    const filter = {
      isDeleted: { $ne: true },
      allocationStatus: { $nin: ['CANCELLED', 'UNALLOCATED'] },
    };
    Object.assign(filter, req.getPeriodFilter());
    const docs = await Workload.find(filter).sort({ empId: 1, createdAt: 1 }).lean();
    const headers = ['#','Emp ID','Name','Faculty Role','Designation','Subject Code','Subject Name','Short',
      'Year','Section','Fixed L','Fixed T','Fixed P','C','Manual L','Manual T','Manual P','Assigned At'];
    const esc = (v) => {
      let s = String(v ?? '');
      if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
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
router.get('/section-workloads', requireAuth, requireAcademicPeriod, async (req, res, next) => {
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

    // B-6 FIX: Exclude soft-deleted and cancelled/unallocated workloads
    const filter = {
      year,
      section,
      isDeleted: { $ne: true },
      allocationStatus: { $nin: ['CANCELLED', 'UNALLOCATED'] },
    };
    Object.assign(filter, req.getPeriodFilter());

    // M-11 FIX: Restrict non-admin faculty to only view their own workloads
    const isAdmin = String(req.user.role || '').toLowerCase() === 'admin' || req.user.canAccessAdmin === true;
    if (!isAdmin) {
      filter.empId = req.user.id;
    }

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
// Returns mapping: { '<courseId>__<section>': { empId, empName, designation, courseId, section, year, manualL, manualT, manualP, fixedL, fixedT, fixedP, C, subjectCode, subjectName } }
router.get('/main-faculty', requireAuth, requireAcademicPeriod, async (req, res, next) => {
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
    const filter = {
      year: normalizedYear,
      facultyRole: 'Main Faculty',
      allocationStatus: 'ALLOCATED',
      empId: { $ne: '' },
      isDeleted: { $ne: true }
    };
    Object.assign(filter, req.getPeriodFilter());

    const docs = await Workload.find(filter).sort({ createdAt: -1 }).lean();

    // Look up missing faculty names/designations if any
    const missingFacultyIds = docs.filter(w => !w.empName || !w.designation).map(w => w.empId);
    let facultyMap = {};
    if (missingFacultyIds.length > 0) {
      const facultyDocs = await Faculty.find({ empId: { $in: missingFacultyIds } }).select('empId name designation department').lean();
      facultyMap = Object.fromEntries(facultyDocs.map(f => [f.empId, f]));
    }

    // Map: courseId__section => faculty details (latest valid workload for each combo)
    const map = {};
    for (const w of docs) {
      const key = `${w.courseId}__${w.section}`;
      if (!map[key]) {
        const fac = facultyMap[w.empId];
        map[key] = {
          empId: w.empId,
          empName: w.empName || fac?.name || w.empId,
          designation: w.designation || fac?.designation || '',
          department: w.department || fac?.department || 'CSE',
          courseId: Number(w.courseId),
          section: String(w.section),
          year: String(w.year),
          manualL: w.manualL,
          manualT: w.manualT,
          manualP: w.manualP,
          fixedL: w.fixedL,
          fixedT: w.fixedT,
          fixedP: w.fixedP,
          C: w.C,
          subjectCode: w.subjectCode,
          subjectName: w.subjectName,
        };
      } else {
        // M-2 FIX: Log when silent deduplication occurs to surface data anomalies
        logger.warn('Duplicate Main Faculty assignment found', {
          courseId: w.courseId,
          section: w.section,
          year: w.year,
          keptEmpId: map[key].empId,
          droppedEmpId: w.empId
        });
      }
    }
    logger.info('Main faculty mapping retrieved', { userId: req.user.id, year: normalizedYear, total: Object.keys(map).length });
    sendSuccess(res, map, 200);
  } catch (err) { 
    logger.error('Error retrieving main-faculty mapping', { error: err.message, userId: req.user.id });
    next(err); 
  }
});

// GET /api/workloads/eligible-faculty
// Centralized endpoint: returns eligible faculty for a given role/slot in the active academic period
router.get('/eligible-faculty', requireAuth, requireAcademicPeriod, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const search = String(req.query.search || '').trim();
    const facultyRole = String(req.query.facultyRole || '').trim();
    const allocationSlot = String(req.query.allocationSlot || '').toUpperCase().trim();
    const allocationRow = req.query.allocationRow !== undefined && req.query.allocationRow !== '' ? Number(req.query.allocationRow) : null;
    const onlyEligible = String(req.query.onlyEligible || '').toLowerCase() === 'true';

    // 1. Resolve Academic Period
    const periodStart = req.academicPeriod?.periodStart || req.academicPeriod?.academicYear?.startDate;
    const periodEnd = req.academicPeriod?.periodEnd || req.academicPeriod?.academicYear?.endDate;
    const periodFilter = req.getPeriodFilter ? req.getPeriodFilter() : {};

    // 2. Fetch Designations to build category map
    const designationDocs = await Designation.find({ isEnabled: { $ne: false } }).lean();
    const desigMap = new Map();
    designationDocs.forEach(d => {
      const cat = d.category || (isTADesignation(d.name) ? 'TA_INSTRUCTOR' : 'FACULTY');
      desigMap.set(d.name.toLowerCase().trim(), cat);
    });

    const getFacultyCategory = (designationName) => {
      const clean = String(designationName || '').toLowerCase().trim();
      if (desigMap.has(clean)) return desigMap.get(clean);
      return isTADesignation(designationName) ? 'TA_INSTRUCTOR' : 'FACULTY';
    };

    // 3. Faculty query
    const hiddenIds = ADMIN_EMPLOYEE_IDS;
    const facultyMatch = {
      isDeleted: { $ne: true },
      empId: { $nin: hiddenIds }
    };

    const dateClauses = buildFacultyDateFilter(periodStart, periodEnd);
    if (dateClauses.length > 0) {
      facultyMatch.$and = dateClauses;
    }

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      const searchOr = [
        { name: searchRegex },
        { empId: searchRegex },
        { designation: searchRegex }
      ];
      if (facultyMatch.$and) {
        facultyMatch.$and.push({ $or: searchOr });
      } else {
        facultyMatch.$or = searchOr;
      }
    }

    const rawFaculty = await Faculty.find(facultyMatch).sort({ slNo: 1, name: 1 }).lean();

    // Deduplicate by empId
    const facultyMap = new Map();
    for (const f of rawFaculty) {
      const empIdKey = String(f.empId || '').trim();
      if (!empIdKey) continue;
      if (!facultyMap.has(empIdKey)) {
        facultyMap.set(empIdKey, f);
      } else {
        const existing = facultyMap.get(empIdKey);
        if (f.updatedAt && (!existing.updatedAt || new Date(f.updatedAt) > new Date(existing.updatedAt))) {
          facultyMap.set(empIdKey, f);
        }
      }
    }
    const facultyList = Array.from(facultyMap.values());
    const empIds = facultyList.map(f => f.empId);

    // 4. Fetch Workloads for these faculty members in the active academic period
    const workloadMatch = {
      empId: { $in: empIds },
      isDeleted: { $ne: true },
      allocationStatus: { $nin: ['CANCELLED', 'UNALLOCATED'] },
      ...periodFilter
    };

    const workloadAgg = await Workload.aggregate([
      { $match: workloadMatch },
      {
        $group: {
          _id: '$empId',
          assignedHours: {
            $sum: {
              $add: [
                {
                  $cond: [
                    { $eq: ['$facultyRole', 'TA'] },
                    0,
                    { $ifNull: ['$manualL', { $ifNull: ['$fixedL', 0] }] }
                  ]
                },
                { $ifNull: ['$manualT', { $ifNull: ['$fixedT', 0] }] },
                { $ifNull: ['$manualP', { $ifNull: ['$fixedP', 0] }] }
              ]
            }
          },
          courseCount: { $sum: 1 }
        }
      }
    ]);

    const workloadByEmpId = new Map();
    workloadAgg.forEach(w => {
      workloadByEmpId.set(String(w._id).trim(), {
        assignedHours: Number(w.assignedHours) || 0,
        courseCount: Number(w.courseCount) || 0
      });
    });

    // 5. Fetch Capacity for these faculty in the active academic period
    const capFilter = {
      empId: { $in: empIds },
      ...(req.getSemesterId && req.getSemesterId() ? periodFilter : {})
    };
    const capacities = await FacultyCapacity.find(capFilter).lean();
    const capacityByEmpId = new Map();
    capacities.forEach(c => {
      if (c.capacity != null) capacityByEmpId.set(String(c.empId).trim(), Number(c.capacity));
    });

    // 6. Eligibility assessment
    const isTaRequested = facultyRole === 'TA' || ['R2', 'R3', 'R4'].includes(allocationSlot) || (allocationRow !== null && allocationRow >= 1);
    const isMainOrSupportingRequested = facultyRole === 'Main Faculty' || facultyRole === 'Supporting Faculty' || allocationSlot === 'R1' || allocationRow === 0;

    let results = facultyList.map((f, idx) => {
      const empIdStr = String(f.empId).trim();
      const wData = workloadByEmpId.get(empIdStr) || { assignedHours: 0, courseCount: 0 };
      const defaultCap = getDefaultCapacity(f.designation);
      const cap = capacityByEmpId.get(empIdStr) || Number(f.capacity || defaultCap);
      const assigned = wData.assignedHours || 0;
      const remaining = cap - assigned;
      const category = getFacultyCategory(f.designation);

      const isTaCategory = category === 'TA_INSTRUCTOR';

      let isEligible = true;
      let ineligibleReason = null;

      if (isMainOrSupportingRequested && isTaCategory) {
        isEligible = false;
        ineligibleReason = `${f.designation} can only be allocated as TA (R2, R3, R4), not as ${facultyRole || allocationSlot || 'Main/Supporting Faculty'}.`;
      }

      let status = 'Available';
      if (assigned > cap) {
        status = 'Overload';
      } else if (assigned === cap && cap > 0) {
        status = 'Fully Loaded';
      } else if (assigned > 0) {
        status = 'Normal';
      }

      return {
        _id: f._id,
        sNo: idx + 1,
        empId: empIdStr,
        name: f.name,
        designation: f.designation,
        category,
        department: f.department || 'CSE',
        mobile: f.mobile || '—',
        email: f.email || '—',
        assignedHours: assigned,
        capacity: cap,
        remainingCapacity: remaining,
        courseCount: wData.courseCount,
        status,
        isEligible,
        ineligibleReason,
        allowedRoles: isTaCategory ? ['TA'] : ['Main Faculty', 'Supporting Faculty', 'TA'],
        allowedSlots: isTaCategory ? ['R2', 'R3', 'R4'] : ['R1', 'R2', 'R3', 'R4']
      };
    });

    if (onlyEligible) {
      results = results.filter(r => r.isEligible);
    }

    sendSuccess(res, results, 200);
  } catch (err) {
    logger.error('Error fetching eligible faculty', { error: err.message });
    next(err);
  }
});

// GET /api/workloads/faculty-hours/:empId (admin/faculty)
// Get faculty workload summary with remaining hours capacity
// MUST BE BEFORE /:id route to match correctly
router.get('/faculty-hours/:empId', requireAuth, requireAcademicPeriod, async (req, res, next) => {
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

    const semester = req.query.semester || null;
    const academicYear = req.query.academicYear || null;
    const summary = await getFacultyWorkloadSummary(empId, null, null, semester, academicYear);
    logger.info('Faculty workload summary retrieved', { empId, summary: { currentLoad: summary.currentLoad, totalCapacity: summary.capacity, utilizationPercent: summary.workloadPercentage }, userId: req.user.id });
    sendSuccess(res, summary, 200);
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
router.get('/workload-report', requireAuth, requireAdmin, requireAcademicPeriod, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { year, semester } = req.query;
    const yearFilter = year ? normalizeYear(year) : null;
    const semesterFilter = semester ;

    const report = await getFacultyWorkloadReport(yearFilter, semesterFilter);
    const summary = {
      totalFaculty: report.length,
      overAllocatedCount: report.filter(f => f.isOverAllocated).length,
      // L-3: Guard against divide-by-zero when report is empty
      averageUtilization: report.length > 0
        ? (report.reduce((sum, f) => sum + f.utilizationPercent, 0) / report.length).toFixed(2)
        : '0.00',
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
 * MUST BE BEFORE /:id route to match correctly
 */
router.put('/:id/periods', requireAuth, requireAdmin, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
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

    const workload = await Workload.findById(id).session(session).lean();
    if (!workload) {
      logger.warn('Workload not found for period update', { id, userId: req.user.id });
      return sendNotFound(res, 'Workload entry not found.');
    }

    const faculty = await Faculty.findOne({ empId: workload.empId }).session(session).lean();
    if (!faculty) {
      logger.warn('Faculty not found for period update validation', { empId: workload.empId, userId: req.user.id });
      return sendNotFound(res, 'Faculty not found.');
    }

    const { getDefaultCapacity } = require('../utils/designationUtils');
    const defaultCap = getDefaultCapacity(faculty.designation);
    const totalCapacity = Number(faculty.capacity || defaultCap);
    
    // Get current total hours excluding this workload
    const otherWorkloads = await Workload.find({ 
      empId: workload.empId, 
      _id: { $ne: id } 
    }).session(session).lean();

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
      { new: true, session }
    ).lean();

    // S-6 FIX: Sync updated hours to CourseAllocation for Main Faculty
    if (result && String(result.facultyRole || 'Main Faculty') === 'Main Faculty') {
      try {
        await syncMainFacultyToAllocation({
          courseId: result.courseId,
          year: result.year,
          section: result.section,
          academicYear: result.academicYear,
          semester: result.semester,
          faculty: {
            empId: result.empId,
            empName: result.empName,
            designation: result.designation,
          },
        }, session);
        logger.info('Synced allocation after period update', { id, empId: result.empId });
      } catch (syncErr) {
        logger.error('Failed to sync allocation after period update', { id, empId: result.empId, error: syncErr.message });
        // Non-fatal — log but do not fail the request
      }
    }



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

    await session.commitTransaction();

    // S-6 FIX: Recalculate capacity after period change
    await recalculateCapacity(workload.empId, { updatedBy: req.user.empId, academicYear: workload.academicYear });

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
    await session.abortTransaction();
    logger.error('Error updating workload periods', { error: err.message, id: req.params.id, userId: req.user.id });
    next(err);
  } finally {
    session.endSession();
  }
});

/**
 * PATCH /deva/workloads/faculty/:empId/capacity
 * Update capacity hours for all workloads of a specific faculty
 * MUST BE BEFORE /:id route to match correctly
 */
router.patch('/faculty/:empId/capacity', requireAuth, requireAdmin, requireAcademicPeriod, async (req, res, next) => {
  try {
    const { empId } = req.params;
    const { capacity } = req.body;

    // Validate input
    if (capacity === undefined || capacity === null) {
      logger.warn('Missing capacity in request', { empId, userId: req.user.id });
      return sendError(res, 'capacity is required.', 400);
    }

    const newCapacity = Number(capacity);
    if (isNaN(newCapacity) || newCapacity <= 0) {
      logger.warn('Invalid capacity value', { empId, capacity, userId: req.user.id });
      return sendError(res, 'capacity must be a positive number.', 400);
    }

    const semType = req.academicPeriod?.academicYearSemester?.semesterType || req.query.semester ;
    const yearName = req.academicPeriod?.academicYear?.name;

    if (!yearName) {
      return sendError(res, 'Validation failed', 400);
    }

    const FacultyCapacity = require('../models/FacultyCapacity');
    // Update the FacultyCapacity collection for the selected semester
    const capRecord = await FacultyCapacity.findOneAndUpdate(
      { empId, semester: semType, academicYear: yearName },
      { $set: { capacity: newCapacity } },
      { new: true, upsert: true }
    );

    if (!capRecord) {
      logger.warn('Faculty not found for capacity update', { empId, userId: req.user.id });
      return sendNotFound(res, 'Faculty capacity could not be updated.');
    }

    // Workload no longer stores capacityHours, so we skip Workload.updateMany
    const modifiedCount = 1;

    // Recalculate capacity to update remaining/percentage
    const { recalculateCapacity } = require('../utils/capacityUtils');
    await recalculateCapacity(empId, { semester: semType, updatedBy: req.user.id, academicYear: yearName });

    logger.info('Faculty capacity updated', {
      empId,
      semester,
      capacity: newCapacity,
      modifiedWorkloads: modifiedCount,
      userId: req.user.id,
    });

    sendSuccess(res, {
      message: `Capacity updated to ${newCapacity}h.`,
      modifiedCount,
    });
  } catch (err) {
    logger.error('Error updating faculty capacity', { error: err.message, userId: req.user.id });
    next(err);
  }
});

/**
 * PATCH /deva/workloads/bulk-visibility
 * Global toggle: Set visibility for ALL workloads in the current academic period
 */
router.patch('/bulk-visibility', requireAuth, requireAdmin, requireAcademicPeriod, async (req, res, next) => {
  try {
    const { isVisible } = req.body;

    if (isVisible === undefined || isVisible === null) {
      logger.warn('Missing isVisible in bulk-visibility request', { userId: req.user.id });
      return sendError(res, 'isVisible is required (true/false).', 400);
    }

    const boolIsVisible = Boolean(isVisible);

    // Explicitly read period context from body, query, headers, or middleware
    const academicYear = req.body?.academicYear || req.query?.academicYear || req.headers['x-academic-year'] || req.academicPeriod?.academicYear?.name;
    const semester = req.body?.semester || req.query?.semester || req.headers['x-semester'] || req.academicPeriod?.academicYearSemester?.semesterType || req.academicPeriod?.semester;
    const academicYearSemesterId = req.body?.academicYearSemesterId || req.query?.academicYearSemesterId || req.headers['x-academic-year-id'] || req.getSemesterId?.();

    const filter = { isDeleted: { $ne: true } };

    if (academicYear && semester) {
      const yearStr = String(academicYear).trim();
      const semStr = String(semester).trim().toUpperCase();
      if (academicYearSemesterId && mongoose.Types.ObjectId.isValid(academicYearSemesterId)) {
        filter.$or = [
          { academicYear: yearStr, semester: semStr },
          { academicYearSemesterId: new mongoose.Types.ObjectId(academicYearSemesterId) }
        ];
      } else {
        filter.academicYear = yearStr;
        filter.semester = semStr;
      }
    } else if (academicYear) {
      filter.academicYear = String(academicYear).trim();
    } else {
      const periodFilter = req.getPeriodFilter ? req.getPeriodFilter() : {};
      Object.assign(filter, periodFilter);
    }

    const result = await Workload.updateMany(filter, { $set: { isVisible: boolIsVisible } });

    logger.info('Global workload visibility toggled', {
      isVisible: boolIsVisible,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
      filter,
      userId: req.user.id
    });

    wsHandler.broadcast({
      type: 'workload_updated',
      action: 'bulk_visibility',
      isVisible: boolIsVisible,
      academicYear,
      semester
    });

    sendSuccess(res, {
      message: `Global visibility updated: All ${result.matchedCount} workloads for ${academicYear || 'active period'} (${semester || 'active semester'}) are now ${boolIsVisible ? 'visible' : 'hidden'}.`,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
      academicYear,
      semester
    });
  } catch (err) {
    logger.error('Error in global workload visibility toggle', { error: err.message, userId: req.user.id });
    next(err);
  }
});

/**
 * PATCH /deva/workloads/faculty-visibility/:empId
 * Toggle visibility for ALL workloads of a specific faculty in the current academic period
 * MUST BE BEFORE /:id/visibility route to match correctly
 */
router.patch('/faculty-visibility/:empId', requireAuth, requireAdmin, requireAcademicPeriod, async (req, res, next) => {
  try {
    const { empId } = req.params;
    const { isVisible } = req.body;

    if (isVisible === undefined || isVisible === null) {
      logger.warn('Missing isVisible in request', { empId, userId: req.user.id });
      return sendError(res, 'isVisible is required (true/false).', 400);
    }

    const boolIsVisible = Boolean(isVisible);

    // Explicitly read period context from body, query, headers, or middleware
    const academicYear = req.body?.academicYear || req.query?.academicYear || req.headers['x-academic-year'] || req.academicPeriod?.academicYear?.name;
    const semester = req.body?.semester || req.query?.semester || req.headers['x-semester'] || req.academicPeriod?.academicYearSemester?.semesterType || req.academicPeriod?.semester;
    const academicYearSemesterId = req.body?.academicYearSemesterId || req.query?.academicYearSemesterId || req.headers['x-academic-year-id'] || req.getSemesterId?.();

    const filter = { empId, isDeleted: { $ne: true } };

    if (academicYear && semester) {
      const yearStr = String(academicYear).trim();
      const semStr = String(semester).trim().toUpperCase();
      if (academicYearSemesterId && mongoose.Types.ObjectId.isValid(academicYearSemesterId)) {
        filter.$or = [
          { academicYear: yearStr, semester: semStr },
          { academicYearSemesterId: new mongoose.Types.ObjectId(academicYearSemesterId) }
        ];
      } else {
        filter.academicYear = yearStr;
        filter.semester = semStr;
      }
    } else if (academicYear) {
      filter.academicYear = String(academicYear).trim();
    } else {
      const periodFilter = req.getPeriodFilter ? req.getPeriodFilter() : {};
      Object.assign(filter, periodFilter);
    }

    const result = await Workload.updateMany(filter, { $set: { isVisible: boolIsVisible } });

    if (result.matchedCount === 0) {
      logger.warn('No workloads found for faculty visibility toggle', { empId, filter, userId: req.user.id });
      return sendNotFound(res, `No workloads found for faculty ${empId} in ${academicYear || 'active year'} (${semester || 'active semester'}).`);
    }

    logger.info('Faculty workloads visibility toggled', {
      empId,
      isVisible: boolIsVisible,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
      filter,
      userId: req.user.id,
    });

    wsHandler.broadcast({
      type: 'workload_updated',
      action: 'faculty_visibility',
      empId,
      isVisible: boolIsVisible,
      academicYear,
      semester
    });

    sendSuccess(res, {
      message: `All workloads for ${empId} in ${academicYear || 'active year'} (${semester || 'active semester'}) are now ${boolIsVisible ? 'visible' : 'hidden'}.`,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
      academicYear,
      semester
    });
  } catch (err) {
    logger.error('Error toggling faculty workloads visibility', { error: err.message, userId: req.user.id });
    next(err);
  }
});

/**
 * PATCH /deva/workloads/:id/visibility
 * Toggle visibility status of a specific workload
 * MUST BE BEFORE final /:id route to match correctly
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
      return sendNotFound(res, 'Workload entry not found.');
    }



    logger.info('Workload visibility toggled', {
      id,
      empId: result.empId,
      isVisible: boolIsVisible,
      userId: req.user.id
    });

    wsHandler.broadcast({
      type: 'workload_updated',
      action: 'single_visibility',
      id,
      isVisible: boolIsVisible
    });

    sendSuccess(res, {
      ...toClient(result),
      message: `Workload is now ${boolIsVisible ? 'visible' : 'hidden'}.`
    });
  } catch (err) {
    logger.error('Error toggling workload visibility', { error: err.message, id: req.params.id, userId: req.user.id });
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
    const isDualAccessAdmin = req.user?.canAccessAdmin === true;
    const isFacultyOnly = req.user.role === 'faculty' && !isDualAccessAdmin;
    if (isFacultyOnly && doc.empId !== req.user.id) {
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
router.post('/', requireAuth, requireAdmin, requireAcademicPeriod, validateWorkloadCreate,
  async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Workload creation validation failed', { userId: req.user.id, errors: errors.array() });
        return sendValidationError(res, errors.array());
      }

          const { empId, courseId, year, section, manualL, manualT, manualP,
            facultyRole, allocationRow,
            empNameOverride, designationOverride, mobileOverride, courseNameOverride, courseTypeOverride } = req.body;

          const normalizedFacultyRole = FACULTY_ROLES.includes(String(facultyRole || '').trim())
            ? String(facultyRole).trim()
            : 'Main Faculty';

          // CRITICAL: Normalize year to canonical format (I/II/III/IV or M.Tech)
          const normalizedYear = normalizeYear(year);
          const normalizedSection = String(section || '').trim();


      const member = await Faculty.findOne({ empId: empId.trim() }).session(session).lean();
      if (!member && !empNameOverride) {
        logger.warn('Employee not found for workload creation', { empId, userId: req.user.id });
        return sendNotFound(res, 'Employee not found.');
      }
      
      if (member) {
        if (member.isDeleted) {
          await session.abortTransaction();
          session.endSession();
          return sendError(res, 'Faculty member has been deleted or deactivated and cannot be assigned workload.', 400);
        }
        const periodStart = req.academicPeriod?.periodStart || req.academicPeriod?.academicYear?.startDate;
        const periodEnd = req.academicPeriod?.periodEnd || req.academicPeriod?.academicYear?.endDate;
        if (periodEnd && member.joiningDate && new Date(member.joiningDate) > new Date(periodEnd)) {
          await session.abortTransaction();
          session.endSession();
          return sendError(res, 'Faculty joined after this semester ends and cannot be allocated.', 400);
        }
        if (member.relievingDate) {
          const relDate = new Date(member.relievingDate);
          if (periodStart && relDate < new Date(periodStart)) {
            await session.abortTransaction();
            session.endSession();
            return sendError(res, 'Faculty was relieved before this semester starts and cannot be allocated.', 400);
          } else if (!periodStart && relDate < new Date()) {
            await session.abortTransaction();
            session.endSession();
            return sendError(res, 'Relieved faculty members cannot receive new workload assignments.', 400);
          }
        }
      }
      const effectiveMember = member || {
        empId: empId.trim(),
        name:  empNameOverride || empId.trim(),
        mobile: String(mobileOverride || '').trim(),
        department: 'CSE',
        designation: designationOverride || 'Other',
      };

      // TA designations can ONLY be allocated as TA (R2, R3, R4)
      const isMemberTa = await isTaDesignationAsync(effectiveMember.designation);
      if (isMemberTa && (normalizedFacultyRole === 'Main Faculty' || normalizedFacultyRole === 'Supporting Faculty')) {
        await session.abortTransaction();
        session.endSession();
        return sendError(res, `${effectiveMember.designation} can only be allocated as TA (R2, R3, R4), not as ${normalizedFacultyRole}.`, 400);
      }

      const course = courseId > 0 ? await Course.findOne({ courseId: Number(courseId) }).session(session).lean() : null;
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

      // CRITICAL: Validate that the selected year matches the course's year
      if (course) {
        // Course has an explicit year - validate it matches the submitted year
        const courseYear = resolveCourseYear(course);
        if (courseYear !== normalizedYear) {
          logger.warn('Year mismatch for course', { 
            courseId, 
            courseSubjectCode: course.subjectCode,
            expectedYear: courseYear, 
            submittedYear: normalizedYear, 
            userId: req.user.id 
          });
          return sendError(res, `Course ${course.subjectCode} is for Year ${courseYear}, but you selected Year ${normalizedYear}. Please select the correct year.`, 400);
        }
      }

      // Backend validation for required fields (no nulls or missing)
      const yearName = req.academicPeriod?.academicYear?.name || req.body?.academicYear || req.query?.academicYear || req.headers['x-academic-year'];
      const semType = req.academicPeriod?.academicYearSemester?.semesterType || req.body?.semester || req.query?.semester || req.headers['x-semester'];
      if (!semType) {
        return sendError(res, 'Validation failed: Semester is required', 400);
      }
      if (course && course.semester && course.semester !== semType) {
        return sendError(res, `Course belongs to ${course.semester} semester, but active context is ${semType} semester.`, 400);
      }
      const semId = req.getSemesterId();
      
      if (!yearName) {
        return sendError(res, 'Validation failed: Academic Year is required', 400);
      }

      const requiredFields = [
        effectiveMember.empId, effectiveMember.name, effectiveMember.designation,
        effectiveCourse.courseType, effectiveCourse.subjectCode, effectiveCourse.subjectName, effectiveCourse.shortName, effectiveCourse.program,
        normalizedYear, normalizedSection
      ];
      if (requiredFields.some(f => f === undefined || f === null || f === '')) {
        logger.warn('Missing required field in workload assignment', { empId, courseId, userId: req.user.id });
        return sendError(res, 'Missing or null required field in workload assignment.', 400);
      }

      const sectionCheck = await ensureValidSection(normalizedYear, normalizedSection, yearName, semType);
      if (!sectionCheck.ok) {
        logger.warn('Invalid section for workload', { year: normalizedYear, section: normalizedSection, userId: req.user.id });
        return sendError(res, sectionCheck.message, 400);
      }

      if (course && Array.isArray(course.allowedSections) && course.allowedSections.length > 0) {
        if (!course.allowedSections.includes(normalizedSection)) {
          logger.warn('Section not allowed for course', { courseId, section: normalizedSection, userId: req.user.id });
          return sendError(res, `This course is only available for sections: ${course.allowedSections.join(', ')}`, 400);
        }
      }

      const courseTypeKey = normalizeCourseTypeKey(effectiveCourse.courseType);
      if (normalizedFacultyRole === 'Main Faculty' && courseTypeKey === 'DE' && isRestrictedDeYear(normalizedYear)) {
        const filter = buildDeSectionConflictFilter({
          year: normalizedYear,
          section: normalizedSection,
          academicYear: yearName,
          semester: semType,
          program: effectiveCourse.program,
        });
        filter.isDeleted = { $ne: true };
        const existingDe = await Workload.findOne(filter).session(session).lean();
        if (existingDe && existingDe.empId !== effectiveMember.empId) {
          logger.warn('Department Elective duplicate for section', { year: normalizedYear, section: normalizedSection, userId: req.user.id });
          return sendConflict(res, `Only one Department Elective can be assigned to ${normalizedYear} Year, Section ${normalizedSection} for this semester. Currently assigned to ${existingDe.empName || existingDe.empId}.`);
        }
      }

      if (normalizedFacultyRole === 'Main Faculty') {
        const existingMainFilter = {
          courseId: effectiveCourse.courseId,
          year: normalizedYear,
          section: normalizedSection,
          facultyRole: 'Main Faculty',
          allocationStatus: 'ALLOCATED',
          empId: { $ne: '' },
          academicYear: yearName,
          semester: semType,
          isDeleted: { $ne: true },
        };
        if (effectiveCourse.courseId === 0) {
          existingMainFilter.subjectName = effectiveCourse.subjectName;
        }
        const existingMain = await Workload.findOne(existingMainFilter).session(session);
        if (existingMain) {
          if (existingMain.empId === effectiveMember.empId) {
            // Same faculty member: update hours instead of throwing 409
            existingMain.manualL = manualL ?? effectiveCourse.L;
            existingMain.manualT = manualT ?? effectiveCourse.T;
            existingMain.manualP = manualP ?? effectiveCourse.P;
            existingMain.empName = effectiveMember.name;
            existingMain.designation = effectiveMember.designation;
            existingMain.department = effectiveMember.department || 'CSE';
            existingMain.mobile = effectiveMember.mobile || '';
            await existingMain.save({ session });

            await syncMainFacultyToAllocation({
              courseId: existingMain.courseId,
              year: existingMain.year,
              section: existingMain.section,
              academicYear: yearName,
              semester: semType,
              faculty: {
                empId: existingMain.empId,
                empName: existingMain.empName,
                designation: existingMain.designation,
              },
            }, session);

            await session.commitTransaction();
            await recalculateCapacity(existingMain.empId, { updatedBy: req.user.empId, semester: existingMain.semester, academicYear: existingMain.academicYear });
            wsHandler.broadcast({ type: 'workload_updated' });
            return sendSuccess(res, toClient(existingMain), 200, { message: 'Workload updated successfully.' });
          } else {
            logger.warn('Main faculty already assigned', { courseId: effectiveCourse.courseId, year: normalizedYear, section: normalizedSection, existingEmpId: existingMain.empId, newEmpId: effectiveMember.empId, userId: req.user.id });
            return sendConflict(res, `This course is already allocated to ${existingMain.empName || existingMain.empId} as Main Faculty for ${normalizedYear} Year, Section ${normalizedSection}.`);
          }
        }
      }

      if (normalizedFacultyRole === 'TA') {
        const parsedRow = Number(allocationRow);
        if (!Number.isInteger(parsedRow) || parsedRow < 1 || parsedRow > 3) {
          logger.warn('Invalid allocation row for TA', { allocationRow, userId: req.user.id });
          return sendError(res, 'TA allocationRow must be 1, 2, or 3 (R2, R3, R4).', 400);
        }

        const existingTaFilter = {
          courseId: effectiveCourse.courseId,
          year: normalizedYear,
          section: normalizedSection,
          facultyRole: 'TA',
          allocationStatus: 'ALLOCATED',
          empId: { $ne: '' },
          academicYear: yearName,
          semester: semType,
          isDeleted: { $ne: true },
          allocationRow: parsedRow,
        };
        if (effectiveCourse.courseId === 0) {
          existingTaFilter.subjectName = effectiveCourse.subjectName;
        }
        const existingTa = await Workload.findOne(existingTaFilter).session(session);
        if (existingTa) {
          if (existingTa.empId === effectiveMember.empId) {
            existingTa.manualL = 0; // TAs cannot have lecture hours
            existingTa.manualT = manualT ?? effectiveCourse.T;
            existingTa.manualP = manualP ?? effectiveCourse.P;
            await existingTa.save({ session });
            await syncTAToAllocation({
              courseId: existingTa.courseId,
              year: existingTa.year,
              section: existingTa.section,
              academicYear: yearName,
              semester: semType,
              faculty: { empId: existingTa.empId, empName: existingTa.empName, designation: existingTa.designation },
              allocationRow: existingTa.allocationRow,
            }, session);
            await session.commitTransaction();
            await recalculateCapacity(existingTa.empId, { updatedBy: req.user.empId, semester: existingTa.semester, academicYear: existingTa.academicYear });
            wsHandler.broadcast({ type: 'workload_updated' });
            return sendSuccess(res, toClient(existingTa), 200, { message: 'TA workload updated successfully.' });
          } else {
            logger.warn('TA already assigned for section', { courseId: effectiveCourse.courseId, year: normalizedYear, section: normalizedSection, allocationRow: parsedRow, userId: req.user.id });
            return sendConflict(res, `TA slot R${parsedRow + 1} is already assigned to ${existingTa.empName || existingTa.empId} for this course and section.`);
          }
        }
      }

      // CRITICAL: Validate workload hours capacity
      const lectureHours = normalizedFacultyRole === 'TA' ? 0 : (manualL ?? effectiveCourse.L);
      const tutorialHours = manualT ?? effectiveCourse.T;
      const practicalHours = manualP ?? effectiveCourse.P;
      const hoursToAssign = lectureHours + tutorialHours + practicalHours;

      try {
        const workloadCheck = await canAssignWorkload(effectiveMember.empId, lectureHours, tutorialHours, practicalHours, null, session, semType, yearName);
        if (!workloadCheck.canAssign && !req.body.allowOverload) {
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

      const duplicateRoleFilter = {
        empId: effectiveMember.empId,
        courseId: effectiveCourse.courseId,
        year: normalizedYear,
        section: normalizedSection,
        facultyRole: normalizedFacultyRole,
        allocationStatus: 'ALLOCATED',
        academicYear: yearName,
        semester: semType,
        isDeleted: { $ne: true },
      };
      if (effectiveCourse.courseId === 0) {
        duplicateRoleFilter.subjectName = effectiveCourse.subjectName;
      }
      const duplicateRole = await Workload.findOne(duplicateRoleFilter).session(session);
      if (duplicateRole) {
        duplicateRole.manualL = normalizedFacultyRole === 'TA' ? 0 : (manualL ?? effectiveCourse.L);
        duplicateRole.manualT = manualT ?? effectiveCourse.T;
        duplicateRole.manualP = manualP ?? effectiveCourse.P;
        if (normalizedFacultyRole === 'TA' && allocationRow !== undefined) {
          duplicateRole.allocationRow = Number(allocationRow);
        }
        await duplicateRole.save({ session });

        if (normalizedFacultyRole === 'Main Faculty') {
          await syncMainFacultyToAllocation({
            courseId: duplicateRole.courseId,
            year: duplicateRole.year,
            section: duplicateRole.section,
            academicYear: yearName,
            semester: semType,
            faculty: {
              empId: duplicateRole.empId,
              empName: duplicateRole.empName,
              designation: duplicateRole.designation,
            },
          }, session);
        } else if (normalizedFacultyRole === 'TA') {
          await syncTAToAllocation({
            courseId: duplicateRole.courseId,
            year: duplicateRole.year,
            section: duplicateRole.section,
            academicYear: yearName,
            semester: semType,
            faculty: { empId: duplicateRole.empId, empName: duplicateRole.empName, designation: duplicateRole.designation },
            allocationRow: duplicateRole.allocationRow,
          }, session);
        }

        await session.commitTransaction();
        await recalculateCapacity(duplicateRole.empId, { updatedBy: req.user.empId, semester: duplicateRole.semester, academicYear: duplicateRole.academicYear });
        wsHandler.broadcast({ type: 'workload_updated' });
        return sendSuccess(res, toClient(duplicateRole), 200, { message: 'Workload updated successfully.' });
      }

      const createdDocs = await Workload.create([{
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
        manualL: normalizedFacultyRole === 'TA' ? 0 : (manualL ?? effectiveCourse.L),
        manualT: manualT ?? effectiveCourse.T,
        manualP: manualP ?? effectiveCourse.P,
        allocationRow: normalizedFacultyRole === 'TA' ? Number(allocationRow) : null,
        academicYear: yearName,
        academicYearSemesterId: semId,
        semester: semType,
      }], { session });
      const doc = createdDocs[0];

      if (normalizedFacultyRole === 'Main Faculty') {
        await syncMainFacultyToAllocation({
          courseId: doc.courseId,
          year: doc.year,
          section: doc.section,
          academicYear: doc.academicYear,
          semester: doc.semester,
          faculty: {
            empId: doc.empId,
            empName: doc.empName,
            designation: doc.designation,
          },
        }, session); // H-5: Pass session so sync is part of the same transaction
      }

      if (normalizedFacultyRole === 'TA') {
        await syncTAToAllocation({
          courseId: doc.courseId,
          year: doc.year,
          section: doc.section,
          academicYear: doc.academicYear,
          semester: doc.semester,
          faculty: { empId: doc.empId, empName: doc.empName, designation: doc.designation },
          allocationRow: doc.allocationRow,
        }, session); // H-5: Pass session
      }


      logger.info('Workload created', { id: String(doc._id), empId: doc.empId, courseId: doc.courseId, year: doc.year, section: doc.section, userId: req.user.id });
      
      await session.commitTransaction();
      // H-6: recalculateCapacity runs AFTER commit so it starts a fresh operation
      await recalculateCapacity(doc.empId, { updatedBy: req.user.empId, semester: doc.semester, academicYear: doc.academicYear });
      wsHandler.broadcast({ type: 'workload_updated' });
      sendCreated(res, toClient(doc));
    } catch (err) {
      await session.abortTransaction();
      if (isTaUniqueIndexError(err)) {
        logger.error('TA unique index error', { error: err.message, userId: req.user.id });
        return sendConflict(res, TA_SECTION_DUPLICATE_MSG);
      }
      if (isDeUniqueIndexError(err)) {
        logger.error('DE unique index error', { error: err.message, userId: req.user.id });
        return sendConflict(res, DE_SECTION_DUPLICATE_MSG);
      }
      if (isDuplicateKeyError(err) || isWriteConflictError(err)) {
        logger.warn('Duplicate key or write conflict error', { error: err.message, userId: req.user.id });
        return sendConflict(res, MAIN_FACULTY_DUPLICATE_MSG);
      }
      logger.error('Error creating workload', { error: err.message, userId: req.user.id });
      next(err);
    } finally {
      session.endSession();
    }
  }
);

// PUT /api/workloads/:id  (admin)
router.put('/:id', requireAuth, requireAdmin, requireAcademicPeriod, validateWorkloadUpdate, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Workload update validation failed', { id: req.params.id, userId: req.user.id, errors: errors.array() });
      return sendValidationError(res, errors.array());
    }

    const current = await Workload.findById(req.params.id).session(session).lean();
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

    const yearName = req.academicPeriod?.academicYear?.name || current.academicYear || req.body?.academicYear || req.query?.academicYear || req.headers['x-academic-year'];
    const semType = req.academicPeriod?.academicYearSemester?.semesterType || current.semester || req.body?.semester || req.query?.semester || req.headers['x-semester'];
    const sectionCheck = await ensureValidSection(nextYear, nextSection, yearName, semType);
    if (!sectionCheck.ok) {
      logger.warn('Invalid section in workload update', { id: req.params.id, year: nextYear, section: nextSection, userId: req.user.id });
      return sendError(res, sectionCheck.message, 400);
    }

    const nextEmpId = String(updates.empId ?? current.empId).trim();
    const member = await Faculty.findOne({ empId: nextEmpId }).session(session).lean();
    if (member) {
      if (member.isDeleted) {
        await session.abortTransaction();
        session.endSession();
        return sendError(res, 'Faculty member has been deleted or deactivated and cannot be assigned workload.', 400);
      }
      const periodStart = req.academicPeriod?.periodStart || req.academicPeriod?.academicYear?.startDate;
      const periodEnd = req.academicPeriod?.periodEnd || req.academicPeriod?.academicYear?.endDate;
      if (periodEnd && member.joiningDate && new Date(member.joiningDate) > new Date(periodEnd)) {
        await session.abortTransaction();
        session.endSession();
        return sendError(res, 'Faculty joined after this semester ends and cannot be allocated.', 400);
      }
      if (member.relievingDate) {
        const relDate = new Date(member.relievingDate);
        if (periodStart && relDate < new Date(periodStart)) {
          await session.abortTransaction();
          session.endSession();
          return sendError(res, 'Faculty was relieved before this semester starts and cannot be allocated.', 400);
        } else if (!periodStart && relDate < new Date()) {
          await session.abortTransaction();
          session.endSession();
          return sendError(res, 'Relieved faculty members cannot receive new workload assignments.', 400);
        }
      }
    }
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

    // TA designations can ONLY be allocated as TA (R2, R3, R4)
    const isMemberTa = await isTaDesignationAsync(effectiveMember.designation);
    if (isMemberTa && (normalizedFacultyRole === 'Main Faculty' || normalizedFacultyRole === 'Supporting Faculty')) {
      await session.abortTransaction();
      session.endSession();
      return sendError(res, `${effectiveMember.designation} can only be allocated as TA (R2, R3, R4), not as ${normalizedFacultyRole}.`, 400);
    }

    const course = await Course.findOne({ courseId: nextCourseId }).session(session).lean();
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

    // CRITICAL: Validate that the selected year matches the course's year
    if (course) {
      // Course has an explicit year - validate it matches the submitted year
      const courseYear = resolveCourseYear(course);
      const normalizedUpdateYear = normalizeYear(nextYear);
      if (courseYear !== normalizedUpdateYear) {
        logger.warn('Year mismatch for course in update', { 
          courseId: nextCourseId, 
          courseSubjectCode: course.subjectCode,
          expectedYear: courseYear, 
          submittedYear: normalizedUpdateYear, 
          userId: req.user.id 
        });
        return sendError(res, `Course ${course.subjectCode} is for Year ${courseYear}, but you selected Year ${normalizedUpdateYear}. Please select the correct year.`, 400);
      }
    }

    if (course && Array.isArray(course.allowedSections) && course.allowedSections.length > 0) {
      if (!course.allowedSections.includes(nextSection)) {
        logger.warn('Section not allowed for course in update', { courseId: nextCourseId, section: nextSection, userId: req.user.id });
        return sendError(res, `This course is only available for sections: ${course.allowedSections.join(', ')}`, 400);
      }
    }

    const targetId = new mongoose.Types.ObjectId(req.params.id);

    if (normalizedFacultyRole === 'Main Faculty') {
      const duplicateMain = await Workload.findOne({
        _id: { $ne: targetId },
        courseId: effectiveCourse.courseId,
        year: nextYear,
        section: nextSection,
        facultyRole: 'Main Faculty',
        allocationStatus: 'ALLOCATED',
        empId: { $ne: '' },
        academicYear: yearName,
        semester: semType,
      }).session(session).lean();
      if (duplicateMain) {
        logger.warn('Main faculty duplicate in update', { id: req.params.id, courseId: effectiveCourse.courseId, year: nextYear, section: nextSection, userId: req.user.id });
        return sendConflict(res, MAIN_FACULTY_DUPLICATE_MSG);
      }
    }

    if (normalizedFacultyRole === 'TA') {
        const nextAllocationRow = (() => {
          const parsed = Number(updates.allocationRow !== undefined ? updates.allocationRow : existing.allocationRow);
          return Number.isInteger(parsed) ? parsed : null;
        })();
        
        if (nextAllocationRow !== null) {
          const duplicateTa = await Workload.findOne({
            _id: { $ne: targetId },
            courseId: effectiveCourse.courseId,
            year: nextYear,
            section: nextSection,
            facultyRole: 'TA',
            allocationRow: nextAllocationRow,
            allocationStatus: 'ALLOCATED',
            empId: { $ne: '' },
            academicYear: yearName,
            semester: semType,
          }).session(session).lean();
          if (duplicateTa) {
            logger.warn('TA duplicate in update', { id: req.params.id, courseId: effectiveCourse.courseId, year: nextYear, section: nextSection, userId: req.user.id });
            return sendConflict(res, TA_SECTION_DUPLICATE_MSG);
          }
        }
      }

    const duplicateRole = await Workload.findOne({
      _id: { $ne: targetId },
      empId: effectiveMember.empId,
      courseId: effectiveCourse.courseId,
      year: nextYear,
      section: nextSection,
      facultyRole: normalizedFacultyRole,
      allocationStatus: 'ALLOCATED',
      academicYear: yearName,
      semester: semType,
    }).session(session).lean();

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
      manualL: normalizedFacultyRole === 'TA' ? 0 : Number(updates.manualL ?? current.manualL ?? effectiveCourse.L ?? 0),
      manualT: Number(updates.manualT ?? current.manualT ?? effectiveCourse.T ?? 0),
      manualP: Number(updates.manualP ?? current.manualP ?? effectiveCourse.P ?? 0),
      allocationRow: nextAllocationRow,
      semester: course ? course.semester : (current.semester ),
    };

    // CRITICAL: Validate workload hours capacity
    try {
      const workloadCheck = await canAssignWorkload(
        effectiveMember.empId,
        safeUpdates.manualL,
        safeUpdates.manualT,
        safeUpdates.manualP,
        req.params.id,
        session,
        safeUpdates.semester,
        current.academicYear
      );
      if (!workloadCheck.canAssign && !req.body.allowOverload) {
        logger.warn('Faculty workload capacity exceeded during update', {
          id: req.params.id,
          empId: effectiveMember.empId,
          reason: workloadCheck.reason,
          userId: req.user.id
        });
        return sendError(res, `Workload update failed: ${workloadCheck.reason}`, 400);
      }
    } catch (hourErr) {
      logger.error('Error validating workload hours during update', { id: req.params.id, error: hourErr.message, userId: req.user.id });
      return sendError(res, 'Error validating faculty capacity. Please contact support.', 500);
    }

    if (normalizedFacultyRole === 'Main Faculty' && safeUpdates.courseTypeKey === 'DE' && isRestrictedDeYear(nextYear)) {
      const existingDe = await Workload.findOne(
        buildDeSectionConflictFilter({
          year: nextYear,
          section: nextSection,
          excludeId: req.params.id,
          academicYear: current.academicYear,
          semester: current.semester,
          program: safeUpdates.program
        })
      ).session(session).lean();
      if (existingDe && existingDe.empId !== effectiveMember.empId) {
        logger.warn('DE constraint violation in update', { id: req.params.id, year: nextYear, section: nextSection, userId: req.user.id });
        return sendConflict(res, `Only one Department Elective can be assigned to ${nextYear} Year, Section ${nextSection} for this semester. Currently assigned to ${existingDe.empName || existingDe.empId}.`);
      }
    }

    const doc = await Workload.findByIdAndUpdate(req.params.id, { $set: safeUpdates }, { new: true, session }).lean();
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
          academicYear: current.academicYear,
          semester: current.semester,
        }, session);
      }
    }

    if (isMainFaculty) {
      await syncMainFacultyToAllocation({
        courseId: doc.courseId,
        year: doc.year,
        section: doc.section,
        academicYear: doc.academicYear,
        semester: doc.semester,
        faculty: {
          empId: doc.empId,
          empName: doc.empName,
          designation: doc.designation,
        },
      }, session); // H-5: Pass session
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
          academicYear: current.academicYear,
          semester: current.semester,
        }, session);
      }
    }

    if (isTA && doc.allocationRow) {
      await syncTAToAllocation({
        courseId: doc.courseId,
        year: doc.year,
        section: doc.section,
        academicYear: doc.academicYear,
        semester: doc.semester,
        faculty: { empId: doc.empId, empName: doc.empName, designation: doc.designation },
        allocationRow: doc.allocationRow,
      }, session); // H-5: Pass session
    }


    logger.info('Workload updated', { id: String(doc._id), empId: doc.empId, courseId: doc.courseId, year: doc.year, section: doc.section, userId: req.user.id });

    await session.commitTransaction();
    // H-6: Recalculate capacity AFTER commit so it starts fresh (outside transaction)
    await recalculateCapacity(doc.empId, { updatedBy: req.user.empId, semester: doc.semester, academicYear: doc.academicYear });
    if (current.empId !== doc.empId) {
      await recalculateCapacity(current.empId, { updatedBy: req.user.empId, semester: doc.semester, academicYear: doc.academicYear });
    }
    wsHandler.broadcast({ type: 'workload_updated' });
    sendSuccess(res, toClient(doc), 200);
  } catch (err) {
    await session.abortTransaction();
    if (isTaUniqueIndexError(err)) {
      logger.error('TA unique index error in update', { error: err.message, id: req.params.id, userId: req.user.id });
      return sendConflict(res, TA_SECTION_DUPLICATE_MSG);
    }
    if (isDeUniqueIndexError(err)) {
      logger.error('DE unique index error in update', { error: err.message, id: req.params.id, userId: req.user.id });
      return sendConflict(res, DE_SECTION_DUPLICATE_MSG);
    }
    if (isDuplicateKeyError(err) || isWriteConflictError(err)) {
      logger.warn('Duplicate key or write conflict error in update', { error: err.message, id: req.params.id, userId: req.user.id });
      return sendConflict(res, MAIN_FACULTY_DUPLICATE_MSG);
    }
    logger.error('Error updating workload', { error: err.message, id: req.params.id, userId: req.user.id });
    next(err);
  } finally {
    session.endSession();
  }
});

// DELETE /api/workloads/:id  (admin)
// S-7 FIX: Soft-delete only — never physically destroy workload records.
// Sets isDeleted=true and deletedAt timestamp to preserve audit trail.
router.delete('/:id', requireAuth, requireAdmin, validateWorkloadDelete, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Workload deletion validation failed', { id: req.params.id, userId: req.user.id, errors: errors.array() });
      return sendValidationError(res, errors.array());
    }

    // Find the record first (do not delete yet)
    const doc = await Workload.findById(req.params.id).session(session).lean();
    if (!doc || (req.query.semester && doc.semester !== req.query.semester && !(req.query.semester === 'ODD' && !doc.semester))) {
      logger.warn('Workload entry not found for deletion or semester mismatch', { id: req.params.id, userId: req.user.id });
      return sendNotFound(res, 'Workload entry not found.');
    }

    // Already soft-deleted — idempotent
    if (doc.isDeleted) {
      await session.abortTransaction();
      session.endSession();
      return sendSuccess(res, { message: 'Workload entry already deleted.' }, 200);
    }

    // S-7 FIX: Soft-delete instead of hard delete
    await Workload.findByIdAndUpdate(
      req.params.id,
      { $set: { isDeleted: true, deletedAt: new Date(), allocationStatus: 'CANCELLED' } },
      { session }
    );

    if (String(doc.facultyRole || 'Main Faculty') === 'Main Faculty') {
      await clearMainFacultyFromAllocation({
        courseId: doc.courseId,
        year: doc.year,
        section: doc.section,
        empId: doc.empId,
        academicYear: doc.academicYear,
        semester: doc.semester,
      }, session);
    }

    if (String(doc.facultyRole || '') === 'TA' && doc.allocationRow) {
      await clearTAFromAllocation({
        courseId: doc.courseId,
        year: doc.year,
        section: doc.section,
        allocationRow: doc.allocationRow,
        academicYear: doc.academicYear,
        semester: doc.semester,
      }, session);
    }


    logger.info('Workload soft-deleted', { id: String(doc._id), empId: doc.empId, courseId: doc.courseId, year: doc.year, section: doc.section, userId: req.user.id });

    await session.commitTransaction();
    // H-6: Recalculate capacity AFTER commit (outside transaction scope)
    await recalculateCapacity(doc.empId, { updatedBy: req.user.empId, semester: doc.semester, academicYear: doc.academicYear });
    wsHandler.broadcast({ type: 'workload_updated' });
    sendSuccess(res, { message: 'Workload entry deleted.' }, 200);
  } catch (err) {
    await session.abortTransaction();
    logger.error('Error deleting workload', { error: err.message, id: req.params.id, userId: req.user.id });
    next(err); 
  } finally {
    session.endSession();
  }
});

module.exports = router;


