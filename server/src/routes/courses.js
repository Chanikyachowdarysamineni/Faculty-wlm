/**
 * routes/courses.js
 *
 * GET    /api/courses          — list (optional ?program=&courseType=&year=)
 * GET    /api/courses/:id      — get one
 * POST   /api/courses          — create (admin)
 * PUT    /api/courses/:id      — update (admin)
 * DELETE /api/courses/:id      — delete (admin)
 */

'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const { mongoose } = require('../db');
const Course = require('../models/Course');
const Workload = require('../models/Workload');
const CourseAllocation = require('../models/CourseAllocation');
const { nextSequence } = require('../utils/counters');
const { parsePagination, buildMeta } = require('../utils/pagination');
const { logAuditEvent } = require('../utils/audit');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendSuccess, sendError, sendValidationError, sendPaginated, sendCreated, sendConflict, sendNotFound } = require('../utils/response');
const logger = require('../utils/logger');
const { validateCourseCreate, validatePagination } = require('../middleware/validators');

const router = express.Router();

// CRITICAL: Normalize year format (numeric or Roman numeral) to canonical form
// Maps: '1' -> 'I', '2' -> 'II', '3' -> 'III', '4' -> 'IV'
const normalizeYear = (year) => {
  const trimmed = String(year || '').trim().toUpperCase();
  if (trimmed === 'I' || trimmed === '1') return 'I';
  if (trimmed === 'II' || trimmed === '2') return 'II';
  if (trimmed === 'III' || trimmed === '3') return 'III';
  if (trimmed === 'IV' || trimmed === '4') return 'IV';
  return trimmed; // Return as-is if not recognized
};

// HELPER: Derive year from subject code if year field is empty
// Examples: 25CS101 -> Year I (101 third digit), 25CS203 -> Year II (203 third digit), etc.
const deriveYearFromCode = (subjectCode) => {
  if (!subjectCode) return 'I'; // Default fallback

  const code = String(subjectCode).toUpperCase().trim();

  // Pattern: Try to extract year digit from course code
  // Format: [YY][DEPT][XXX] where XXX first digit indicates year
  // Examples: 25CS101 (year I), 25CS203 (year II), 25CS301 (year III), 25CS401 (year IV)
  const match = code.match(/\d{2}[A-Z]+(\d)/);
  if (match && match[1]) {
    const yearDigit = match[1];
    if (yearDigit === '0') return 'I';      // 01-09 → Year I
    if (yearDigit === '1') return 'I';      // 101-109 → Year I
    if (yearDigit === '2') return 'II';     // 201-209 → Year II
    if (yearDigit === '3') return 'III';    // 301-309 → Year III
    if (yearDigit === '4') return 'IV';     // 401-409 → Year IV
  }
  return 'I'; // Default fallback
};

const COURSE_TYPES = ['Mandatory', 'Department Elective', 'Open Elective', 'Minors', 'Honours'];

const toClient = (doc) => {
  // Determine year: priority given to explicit year field, fallback to deriving from code
  const year = doc.year && String(doc.year).trim()
    ? normalizeYear(doc.year)
    : deriveYearFromCode(doc.subjectCode);

  return {
    id: String(doc.courseId || 0),
    program: String(doc.program || '').trim() || 'N/A',
    courseType: String(doc.courseType || '').trim() || 'OTHER',
    year: year,
    subjectCode: String(doc.subjectCode || '').trim(),
    subjectName: String(doc.subjectName || '').trim(),
    shortName: String(doc.shortName || '').trim(),
    L: Number(doc.L || 0),
    T: Number(doc.T || 0),
    P: Number(doc.P || 0),
    C: Number(doc.C || 0),
    department: String(doc.department || 'CSE'),
    isDeleted: Boolean(doc.isDeleted),
    createdAt: doc.createdAt?.toISOString() || null,
  };
};

// GET /api/courses
router.get('/', requireAuth, validatePagination, async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.includeDeleted !== 'true') {
      filter.isDeleted = { $ne: true };
    }
    if (req.query.program) filter.program = req.query.program;
    if (req.query.courseType) filter.courseType = req.query.courseType;
    // CRITICAL: Normalize year to canonical format (I/II/III/IV or M.Tech) for consistent filtering
    if (req.query.year) filter.year = normalizeYear(req.query.year);
    if (req.query.search) {
      const q = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { subjectCode: { $regex: q, $options: 'i' } },
        { subjectName: { $regex: q, $options: 'i' } },
        { shortName: { $regex: q, $options: 'i' } },
      ];
    }
    const [total, docs] = await Promise.all([
      Course.countDocuments(filter),
      Course.find(filter)
        .select('courseId program courseType year subjectCode subjectName shortName L T P C department isDeleted createdAt')
        .sort({ courseId: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);
    logger.info('Courses listed', { userId: req.user.id, filter, total, page, limit });
    sendPaginated(res, docs.map(toClient), { total, page, limit }, 200);
  } catch (err) {
    logger.error('Error listing courses', { error: err.message, userId: req.user.id });
    next(err);
  }
});

// GET /api/courses/deleted  (admin)
router.get('/deleted', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const docs = await Course.find({ isDeleted: true }).lean();
    sendSuccess(res, docs.map(toClient), 200);
  } catch (err) { next(err); }
});

// GET /api/courses/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await Course.findOne({ courseId: Number(req.params.id) }).lean();
    if (!doc) {
      logger.warn('Course not found', { courseId: req.params.id, userId: req.user.id });
      return sendNotFound(res, 'Course not found.');
    }
    logger.info('Course retrieved', { courseId: req.params.id, userId: req.user.id });
    sendSuccess(res, toClient(doc), 200);
  } catch (err) {
    logger.error('Error retrieving course', { error: err.message, courseId: req.params.id, userId: req.user.id });
    next(err);
  }
});

// POST /api/courses  (admin)
router.post(
  '/',
  requireAuth, requireAdmin,
  validateCourseCreate,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Course creation validation failed', { userId: req.user.id, errors: errors.array() });
        return sendValidationError(res, errors.array());
      }

      const maxDoc = await Course.findOne().sort({ courseId: -1 }).lean();
      const courseId = await nextSequence('course_id', Number(maxDoc?.courseId || 0));

      const { program, courseType, year = '', subjectCode, subjectName, shortName, L, T, P, C, department, academicYear, semester, regulations, status, description, allocationStatus, allowedSections = [] } = req.body;
      const normalizedSubjectCode = String(subjectCode || '').trim().toUpperCase();
      const normalizedYear = normalizeYear(year);

      const courseTypeNormalized = String(courseType || '').trim();

      const doc = await Course.create({
        courseId,
        program: String(program || '').trim(),
        courseType: String(courseType || '').trim(),
        year: normalizedYear,
        subjectCode: normalizedSubjectCode,
        subjectName: String(subjectName || '').trim(),
        shortName: String(shortName || '').trim(),
        L: Number(L) || 0,
        T: Number(T) || 0,
        P: Number(P) || 0,
        C: Number(C) || 0,
        department: String(department || 'CSE').trim(),
        academicYear: String(academicYear || '').trim(),
        semester: String(semester || '').trim(),
        regulations: String(regulations || '').trim(),
        status: status || 'Active',
        description: String(description || '').trim(),
        allocationStatus: allocationStatus || 'Pending',
        isDeleted: false,
        allowedSections: Array.isArray(allowedSections) ? allowedSections.map(s => String(s).trim()).filter(Boolean) : [],
      });
      await logAuditEvent({ req, action: 'course.create', entity: 'course', entityId: String(doc.courseId) });
      logger.info('Course created', { courseId: doc.courseId, subjectCode: doc.subjectCode, userId: req.user.id });
      sendCreated(res, toClient(doc));
    } catch (err) {
      if (err.code === 11000 || err.code === 11001) {
        logger.warn('Course duplicate constraint failed', { userId: req.user.id, error: err.message });
        return sendConflict(res, 'Failed to create course due to duplicate unique identifier.');
      }
      logger.error('Error creating course', { error: err.message, userId: req.user.id });
      next(err);
    }
  }
);

// PUT /api/courses/:id  (admin)
router.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const courseId = Number(req.params.id);
    const current = await Course.findOne({ courseId }).session(session).lean();
    if (!current) {
      await session.abortTransaction();
      session.endSession();
      logger.warn('Course not found for update', { courseId, userId: req.user.id });
      return sendNotFound(res, 'Course not found.');
    }

    const updates = { ...req.body };
    
    if (updates.subjectCode !== undefined) updates.subjectCode = String(updates.subjectCode || '').trim().toUpperCase();
    if (updates.courseType !== undefined) updates.courseType = String(updates.courseType || '').trim();
    if (updates.year !== undefined) updates.year = normalizeYear(updates.year);
    if (updates.program !== undefined) updates.program = String(updates.program || '').trim();

    const checkSubjectCode = updates.subjectCode !== undefined ? updates.subjectCode : current.subjectCode;
    const checkCourseType = updates.courseType !== undefined ? updates.courseType : current.courseType;
    
    // No duplicate check required - identical courses are allowed

    if (updates.L !== undefined) updates.L = Number(updates.L) || 0;
    if (updates.T !== undefined) updates.T = Number(updates.T) || 0;
    if (updates.P !== undefined) updates.P = Number(updates.P) || 0;
    if (updates.C !== undefined) updates.C = Number(updates.C) || 0;
    
    if (updates.department !== undefined) updates.department = String(updates.department).trim();
    if (updates.academicYear !== undefined) updates.academicYear = String(updates.academicYear).trim();
    if (updates.semester !== undefined) updates.semester = String(updates.semester).trim();
    if (updates.regulations !== undefined) updates.regulations = String(updates.regulations).trim();
    if (updates.status !== undefined) updates.status = updates.status;
    if (updates.description !== undefined) updates.description = String(updates.description).trim();
    if (updates.allocationStatus !== undefined) updates.allocationStatus = updates.allocationStatus;
    if (updates.isDeleted !== undefined) updates.isDeleted = Boolean(updates.isDeleted);
    
    if (updates.allowedSections !== undefined) {
      updates.allowedSections = Array.isArray(updates.allowedSections) 
        ? updates.allowedSections.map(s => String(s).trim()).filter(Boolean) 
        : [];
    }

    const doc = await Course.findOneAndUpdate(
      { courseId },
      { $set: updates },
      { new: true, runValidators: true, session }
    ).lean();
    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      return sendNotFound(res, 'Course not found.');
    }

    await logAuditEvent({ req, action: 'course.update', entity: 'course', entityId: String(courseId), metadata: { fields: Object.keys(updates) } });

    await session.commitTransaction();
    session.endSession();

    logger.info('Course updated', { courseId, fields: Object.keys(updates), userId: req.user.id });
    sendSuccess(res, toClient(doc), 200);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Error updating course', { error: err.message, courseId: req.params.id, userId: req.user.id });
    next(err);
  }
});

// DELETE /api/courses/:id  (admin)
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const courseId = Number(req.params.id);

    const doc = await Course.findOneAndUpdate(
      { courseId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true, session }
    );

    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      logger.warn('Course not found for deletion', { courseId, userId: req.user.id });
      return sendNotFound(res, 'Course not found.');
    }

    // Cascade soft delete
    await Workload.updateMany(
      { courseId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { session }
    );
    await CourseAllocation.updateMany(
      { courseId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { session }
    );

    await logAuditEvent({ req, action: 'course.delete', entity: 'course', entityId: String(courseId) });

    await session.commitTransaction();
    session.endSession();

    logger.info('Course deleted', { courseId, subjectCode: doc.subjectCode, userId: req.user.id });
    sendSuccess(res, { message: 'Course deleted.' }, 200);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Error deleting course', { error: err.message, courseId: req.params.id, userId: req.user.id });
    next(err);
  }
});

// POST /api/courses/:id/restore  (admin)
router.post('/:id/restore', requireAuth, requireAdmin, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const courseId = Number(req.params.id);
    const doc = await Course.findOneAndUpdate(
      { courseId, isDeleted: true },
      { $set: { isDeleted: false, deletedAt: null } },
      { new: true, session }
    ).lean();

    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      return sendNotFound(res, 'Deleted course not found.');
    }

    // Cascade restore
    await Workload.updateMany(
      { courseId, isDeleted: true },
      { $set: { isDeleted: false, deletedAt: null } },
      { session }
    );
    await CourseAllocation.updateMany(
      { courseId, isDeleted: true },
      { $set: { isDeleted: false, deletedAt: null } },
      { session }
    );

    await logAuditEvent({ req, action: 'course.restore', entity: 'course', entityId: String(courseId) });

    await session.commitTransaction();
    session.endSession();

    logger.info('Course restored', { courseId, userId: req.user.id });
    sendSuccess(res, toClient(doc), 200, { message: 'Course restored successfully.' });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Error restoring course', { error: err.message, courseId: req.params.id, userId: req.user.id });
    next(err);
  }
});

module.exports = router;

