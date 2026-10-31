/**
 * routes/submissions.js
 *
 * GET    /api/submissions              — list all (admin)
 * GET    /api/submissions/export       — export all (admin) ?format=csv|excel
 * GET    /api/submissions/by-faculty/:empId — get one (self or admin)
 * POST   /api/submissions              — submit preferences (auth)
 * PUT    /api/submissions/by-faculty/:empId — update preferences (self or admin, form/edit must be open)
 * DELETE /api/submissions/:id          — delete (admin)
 */

'use strict';

const express     = require('express');
const { body, validationResult } = require('express-validator');
const Submission  = require('../models/Submission');
const Course      = require('../models/Course');
const Faculty     = require('../models/Faculty');
const Setting     = require('../models/Setting');
const AcademicYear = require('../models/AcademicYear');
const AcademicYearSemester = require('../models/AcademicYearSemester');
const { parsePagination, buildMeta } = require('../utils/pagination');
const { requireAuth, requireAdmin, requireSelfOrAdmin } = require('../middleware/auth');
const requireAcademicPeriod = require('../middleware/academicPeriod');
const { sendSuccess, sendError, sendValidationError, sendPaginated, sendCreated, sendConflict, sendNotFound, sendForbidden } = require('../utils/response');
const logger = require('../utils/logger');
const { validateSubmissionCreate, validatePagination } = require('../middleware/validators');
const { exportSubmissions } = require('../utils/exportUtils');
const wsHandler = require('../websocket');

const router = express.Router();

const toClient = (doc) => ({
  id:          doc._id?.toString() || '',
  empId:       String(doc.empId || '').trim(),
  empName:     String(doc.empName || '').trim(),
  designation: String(doc.designation || '').trim() || 'N/A',
  mobile:      String(doc.mobile || '').trim() || 'N/A',
  prefs:       Array.isArray(doc.prefs) ? doc.prefs : [],
  semester:    String(doc.semester || 'ODD'),
  academicYear: String(doc.academicYear || ''),
  submittedAt: doc.createdAt?.toISOString() || null,
  updatedAt:   doc.updatedAt?.toISOString() || null,
});

const validatePrefsAgainstCourses = async (prefs = []) => {
  const ids = Array.from(new Set((prefs || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)));
  if (!ids.length) return { ok: false, message: 'At least one valid course ID is required in preferences.' };

  const rows = await Course.find({ courseId: { $in: ids } }).select({ courseId: 1 }).lean();
  const found = new Set(rows.map((row) => Number(row.courseId)));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) {
    return { ok: false, message: `Invalid course preference ID(s): ${missing.join(', ')}` };
  }
  return { ok: true };
};

const resolveFormAndEditStatus = async (academicYear, semester) => {
  let isFormOpen = null;
  let isEditEnabled = null;

  const sem = String(semester || '').toUpperCase().trim();
  let yearName = String(academicYear || '').trim();

  if (!yearName) {
    const currentYear = await AcademicYear.findOne({ isCurrent: true }).lean();
    yearName = currentYear ? currentYear.name : null;
  }

  if (yearName && sem) {
    const yearDoc = await AcademicYear.findOne({ name: yearName }).lean();
    if (yearDoc) {
      const semDoc = await AcademicYearSemester.findOne({
        academicYearId: yearDoc._id,
        semesterType: sem
      }).lean();
      if (semDoc) {
        if (typeof semDoc.formEnabled === 'boolean') isFormOpen = semDoc.formEnabled;
        if (typeof semDoc.editEnabled === 'boolean') isEditEnabled = semDoc.editEnabled;
      }
    }
  }

  // Fallback to legacy Setting collection
  if (isFormOpen === null) {
    const formSetting = await Setting.findOne({ key: 'form_enabled' }).lean();
    isFormOpen = formSetting ? formSetting.value === 'true' : true;
  }

  if (isEditEnabled === null) {
    const editSetting = await Setting.findOne({ key: 'edit_enabled' }).lean();
    isEditEnabled = editSetting ? editSetting.value === 'true' : true;
  }

  return { isFormOpen, isEditEnabled };
};

// GET /api/submissions  (admin)
router.get('/', requireAuth, requireAdmin, requireAcademicPeriod, validatePagination, async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {
      ...req.getPeriodFilter()
    };
    if (req.query.search) {
      const q = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ empId: { $regex: q, $options: 'i' } }, { empName: { $regex: q, $options: 'i' } }];
    }
    const [total, docs] = await Promise.all([
      Submission.countDocuments(filter),
      Submission.find(filter)
        .select('empId empName designation mobile prefs createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);
    logger.info('Submissions listed', { userId: req.user.id, filter, total, page, limit });
    sendPaginated(res, docs.map(toClient), { total, page, limit }, 200);
  } catch (err) { 
    logger.error('Error listing submissions', { error: err.message, userId: req.user.id });
    next(err); 
  }
});

// GET /api/submissions/by-faculty/:empId  (self or admin)
router.get('/by-faculty/:empId', requireAuth, requireSelfOrAdmin, requireAcademicPeriod, async (req, res, next) => {
  try {
    // Build a filter that includes semester and academicYear so each
    // (academicYear, semester) pair is treated as an independent context.
    const periodFilter = req.getPeriodFilter();
    const empId = String(req.params.empId || '').trim();

    // Also support plain query params as fallback (for non-period-aware callers)
    const semester = req.query.semester || req.body?.semester;
    const academicYear = req.query.academicYear || req.body?.academicYear;

    let filter = { empId };
    if (Object.keys(periodFilter).length > 0) {
      Object.assign(filter, periodFilter);
    } else if (semester || academicYear) {
      if (semester) filter.semester = semester;
      if (academicYear) filter.academicYear = academicYear;
    }
    // If no filter at all, fall back to most recent submission for this faculty

    const doc = await Submission.findOne(filter).sort({ createdAt: -1 }).lean();
    
    if (!doc) {
      // If no submission exists, return an empty submission template
      const member = await Faculty.findOne({ empId }).lean();
      
      logger.info('Empty submission returned (not yet submitted)', { empId, userId: req.user.id, filter });
      
      return sendSuccess(res, {
        id: null,
        empId,
        empName: member?.name ?? 'Unknown',
        designation: member?.designation ?? 'N/A',
        mobile: member?.mobile ?? 'N/A',
        prefs: [],
        semester: semester || '',
        academicYear: academicYear || '',
        submittedAt: null,
        updatedAt: null,
      }, 200);
    }
    
    logger.info('Submission retrieved', { empId, userId: req.user.id, semester: doc.semester, academicYear: doc.academicYear });
    sendSuccess(res, toClient(doc), 200);
  } catch (err) { 
    logger.error('Error retrieving submission', { error: err.message, empId: req.params.empId, userId: req.user.id });
    next(err); 
  }
});

// PUT /api/submissions/by-faculty/:empId  (self or admin — update preferences)
router.put(
  '/by-faculty/:empId',
  requireAuth, requireSelfOrAdmin,
  [
    body('prefs').isArray({ min: 1, max: 5 }).withMessage('Provide 1–5 course preferences.'),
    body('prefs.*').isInt({ min: 1 }).withMessage('Each preference must be a valid course ID.'),
  ],
  async (req, res, next) => {
    try {
      const semester = req.query.semester || req.body?.semester;
      const academicYear = String(req.query.academicYear || req.body?.academicYear || '').trim();
      const isAdmin = String(req.user.role || '').toLowerCase() === 'admin' || req.user.canAccessAdmin === true;

      const { isFormOpen, isEditEnabled } = await resolveFormAndEditStatus(academicYear, semester);
      if (!isFormOpen && !isAdmin) {
        logger.warn('Submission update blocked: form closed', { empId: req.params.empId, userId: req.user.id, semester, academicYear });
        return sendForbidden(res, 'The submission form is currently closed.');
      }

      if (!isEditEnabled && !isAdmin) {
        logger.warn('Edit disabled attempt', { empId: req.params.empId, userId: req.user.id, semester, academicYear });
        return sendForbidden(res, 'Editing submissions is currently disabled by the administrator.');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Submission update validation failed', { empId: req.params.empId, userId: req.user.id, errors: errors.array() });
        return sendValidationError(res, errors.array());
      }

      const { prefs } = req.body;

      if (new Set(prefs).size !== prefs.length) {
        logger.warn('Duplicate preferences in update', { empId: req.params.empId, userId: req.user.id });
        return sendError(res, 'Duplicate course preferences are not allowed.', 400);
      }

      const prefCheck = await validatePrefsAgainstCourses(prefs);
      if (!prefCheck.ok) {
        logger.warn('Invalid course preference in update', { empId: req.params.empId, userId: req.user.id, message: prefCheck.message });
        return sendError(res, prefCheck.message, 400);
      }

      const updateFilter = { empId: req.params.empId, semester };
      if (academicYear) updateFilter.academicYear = academicYear;
      let doc = await Submission.findOneAndUpdate(
        updateFilter,
        { prefs },
        { new: true }
      ).lean();
      if (!doc) {
        if (isAdmin) {
          const member = await Faculty.findOne({ empId: req.params.empId.trim() }).lean();
          doc = await Submission.create({
            empId: req.params.empId.trim(),
            empName: member?.name || req.params.empId,
            designation: member?.designation || '',
            mobile: member?.mobile || '',
            prefs,
            semester: semester || 'EVEN',
            academicYear: academicYear || '2026-2027',
          });
        } else {
          logger.warn('Submission not found for update', { empId: req.params.empId, userId: req.user.id });
          return sendNotFound(res, 'No submission found to update.');
        }
      }

      logger.info('Submission updated', { empId: req.params.empId, prefCount: prefs.length, userId: req.user.id });
      wsHandler.broadcast({
        type: 'submissions_updated',
        data: { action: 'update', empId: req.params.empId }
      });
      sendSuccess(res, toClient(doc), 200);
    } catch (err) { 
      if (err.code === 11000) {
        logger.warn('Duplicate submission in update caught at DB level', { empId: req.params.empId, userId: req.user.id });
        return sendConflict(res, 'A submission already exists for this semester and academic year.');
      }
      logger.error('Error updating submission', { error: err.message, empId: req.params.empId, userId: req.user.id });
      next(err); 
    }
  }
);

// POST /api/submissions  (auth)
router.post(
  '/',
  requireAuth,
  validateSubmissionCreate,
  async (req, res, next) => {
    try {
      const { empId, prefs } = req.body;
      const semester = req.body.semester || 'EVEN';
      let academicYear = String(req.body.academicYear || '').trim();

      if (!academicYear) {
        const currentYear = await AcademicYear.findOne({ isCurrent: true }).lean();
        academicYear = currentYear ? currentYear.name : '2026-2027';
      }

      const isSelf = String(req.user.id) === String(empId || '').trim();
      const isAdmin = String(req.user.role || '').toLowerCase() === 'admin' || req.user.canAccessAdmin === true;

      // Check form open (defaults to open if setting not yet seeded)
      const { isFormOpen } = await resolveFormAndEditStatus(academicYear, semester);
      if (!isFormOpen && !isAdmin) {
        logger.warn('Submission form not open', { empId, userId: req.user.id, semester, academicYear });
        return sendForbidden(res, 'The submission form is currently closed.');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Submission creation validation failed', { empId, userId: req.user.id, errors: errors.array() });
        return sendValidationError(res, errors.array());
      }

      if (!isSelf && !isAdmin) {
        logger.warn('Unauthorized attempt to submit preferences for another faculty', { empId, userId: req.user.id });
        return sendForbidden(res, 'You can only submit preferences for your own account.');
      }

      if (new Set(prefs).size !== prefs.length) {
        logger.warn('Duplicate preferences in submission', { empId, userId: req.user.id });
        return sendError(res, 'Duplicate course preferences are not allowed.', 400);
      }

      const prefCheck = await validatePrefsAgainstCourses(prefs);
      if (!prefCheck.ok) {
        logger.warn('Invalid course preference in submission', { empId, userId: req.user.id, message: prefCheck.message });
        return sendError(res, prefCheck.message, 400);
      }

      // Look up faculty — fall back to request body if not seeded in DB
      const member = await Faculty.findOne({ empId: empId.trim() }).lean();
      const empName     = member?.name        ?? (req.body.empName     || empId);
      const designation = member?.designation ?? (req.body.designation || '');
      const mobile      = member?.mobile      ?? (req.body.mobile      || '');

      if (member && !isAdmin) {
        const { getSemesterPeriodDates, isFacultyEligibleForPeriod } = require('../utils/academicPeriodUtils');
        const periodDates = getSemesterPeriodDates({ academicYear, semesterType: semester });
        if (!isFacultyEligibleForPeriod(member, periodDates.periodStart, periodDates.periodEnd)) {
          return sendError(res, 'You are not eligible to submit preferences for this semester based on your employment dates.', 400);
        }
      }

      // Duplicate check MUST include academicYear + semester so ODD does not block EVEN
      // and prior academic year submissions do not block the current year
      const existing = await Submission.findOne({ empId: empId.trim(), semester, academicYear });
      if (existing) {
        if (isAdmin) {
          existing.prefs = prefs;
          if (empName) existing.empName = empName;
          if (designation) existing.designation = designation;
          if (mobile) existing.mobile = mobile;
          await existing.save();
          logger.info('Submission updated via admin POST', { empId: existing.empId, prefCount: prefs.length, userId: req.user.id });
          wsHandler.broadcast({
            type: 'submissions_updated',
            data: { action: 'update', empId: existing.empId }
          });
          return sendSuccess(res, toClient(existing), 200);
        }
        logger.warn('Duplicate submission attempt', { empId, semester, academicYear, userId: req.user.id });
        return sendConflict(res, 'You have already submitted preferences for this semester and academic year.');
      }

      const doc = await Submission.create({
        empId:       empId.trim(),
        empName,
        designation,
        mobile,
        prefs,
        semester,
        academicYear,
      });

      logger.info('Submission created', { empId: doc.empId, prefCount: prefs.length, userId: req.user.id });
      wsHandler.broadcast({
        type: 'submissions_updated',
        data: { action: 'create', empId: doc.empId }
      });
      sendCreated(res, toClient(doc));
    } catch (err) { 
      if (err.code === 11000) {
        logger.warn('Duplicate submission caught at DB level', { empId: req.body.empId, userId: req.user.id });
        return sendConflict(res, 'You have already submitted preferences for this semester and academic year.');
      }
      logger.error('Error creating submission', { error: err.message, empId: req.body.empId, userId: req.user.id });
      next(err); 
    }
  }
);

// GET /api/submissions/export  (admin) — export all submissions as CSV or Excel (2 worksheets)
router.get('/export', requireAuth, requireAdmin, requireAcademicPeriod, async (req, res, next) => {
  try {
    const format = String(req.query.format || 'csv').toLowerCase();
    if (!['csv', 'excel'].includes(format)) {
      logger.warn('Invalid export format requested', { format, userId: req.user.id });
      return sendError(res, 'Invalid format. Supported: csv, excel', 400);
    }

    const { getSemesterPeriodDates, buildFacultyDateFilter } = require('../utils/academicPeriodUtils');
    const { ADMIN_EMPLOYEE_IDS } = require('../config/adminConfig');
    const { getDefaultCapacity } = require('../utils/designationUtils');

    const academicYear = req.academicPeriod?.academicYear?.name || req.query.academicYear || '';
    const semester = req.academicPeriod?.academicYearSemester?.semesterType || req.query.semester || 'ODD';

    const periodDates = req.academicPeriod || getSemesterPeriodDates({
      academicYear,
      semesterType: semester
    });
    const periodStart = periodDates?.periodStart;
    const periodEnd = periodDates?.periodEnd;

    // Filter eligible faculty active during this academic period, non-deleted, excluding hidden admins
    const hiddenIds = ADMIN_EMPLOYEE_IDS;
    const facultyMatch = { isDeleted: { $ne: true }, empId: { $nin: hiddenIds } };
    const dateClauses = buildFacultyDateFilter(periodStart, periodEnd);
    if (dateClauses.length > 0) {
      facultyMatch.$and = dateClauses;
    }

    const periodFilter = req.getPeriodFilter ? req.getPeriodFilter() : {
      academicYear,
      semester
    };

    // Fetch eligible faculty, submissions, and courses in parallel
    const [allFaculty, docs, courseList] = await Promise.all([
      Faculty.find(facultyMatch).sort({ slNo: 1, name: 1 }).lean(),
      Submission.find({ ...periodFilter })
        .select('empId empName designation mobile prefs createdAt updatedAt')
        .sort({ createdAt: -1 })
        .lean(),
      Course.find({ ...periodFilter })
        .select('courseId shortName name')
        .lean(),
    ]);

    // Map of submitted empIds
    const submittedEmpIdMap = new Map();
    docs.forEach(doc => {
      const key = String(doc.empId || '').trim();
      if (key && !submittedEmpIdMap.has(key)) {
        submittedEmpIdMap.set(key, doc);
      }
    });

    // Lookup map of all eligible faculty by empId
    const facultyByEmpId = new Map();
    allFaculty.forEach(fac => {
      const key = String(fac.empId || '').trim();
      if (key) {
        facultyByEmpId.set(key, fac);
      }
    });

    // Also fetch faculty info for any submitted IDs not currently in allFaculty (e.g. relieved later)
    const missingSubmittedIds = docs
      .map(d => String(d.empId || '').trim())
      .filter(id => id && !facultyByEmpId.has(id));

    if (missingSubmittedIds.length > 0) {
      const extraFaculty = await Faculty.find({ empId: { $in: missingSubmittedIds } }).lean();
      extraFaculty.forEach(fac => {
        facultyByEmpId.set(String(fac.empId || '').trim(), fac);
      });
    }

    // 1. Submitted Faculty List (Sheet 1)
    const submittedList = docs.map(doc => {
      const empId = String(doc.empId || '').trim();
      const fac = facultyByEmpId.get(empId);
      return {
        empId,
        empName: String(doc.empName || fac?.name || '').trim(),
        designation: String(doc.designation || fac?.designation || 'N/A').trim(),
        email: String(fac?.email || '').trim(),
        mobile: String(doc.mobile || fac?.mobile || 'N/A').trim(),
        status: 'Submitted',
        prefs: Array.isArray(doc.prefs) ? doc.prefs : [],
        submittedAt: doc.createdAt?.toISOString() || null,
        updatedAt: doc.updatedAt?.toISOString() || null,
      };
    });

    // 2. Not Submitted Faculty List (Sheet 2: all eligible faculty who have not submitted)
    const notSubmittedList = allFaculty
      .filter(fac => !submittedEmpIdMap.has(String(fac.empId || '').trim()))
      .map(fac => ({
        empId: String(fac.empId || '').trim(),
        empName: String(fac.name || '').trim(),
        designation: String(fac.designation || '').trim() || 'N/A',
        email: String(fac.email || '').trim(),
        mobile: String(fac.mobile || '').trim() || 'N/A',
        status: 'Not Submitted',
        department: String(fac.department || 'CSE').trim(),
        capacity: fac.capacity ?? getDefaultCapacity(fac.designation),
        joiningDate: fac.joiningDate ? new Date(fac.joiningDate).toISOString() : null,
        relievingDate: fac.relievingDate ? new Date(fac.relievingDate).toISOString() : null,
      }));

    // Courses lookup
    const courses = (courseList || []).map(doc => ({
      courseId: Number(doc.courseId || 0),
      shortName: String(doc.shortName || doc.name || '').trim(),
    }));

    const exportResult = await exportSubmissions({
      submissions: submittedList,
      notSubmitted: notSubmittedList,
      courses,
      format,
      academicYear,
      semester,
    });

    logger.info('Submissions exported', {
      format,
      submittedTotal: submittedList.length,
      notSubmittedTotal: notSubmittedList.length,
      totalEligible: allFaculty.length,
      academicYear,
      semester,
      userId: req.user.id
    });

    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    return res.send(exportResult.content);
  } catch (err) {
    logger.error('Error exporting submissions', { error: err.message, userId: req.user?.id });
    next(err);
  }
});

// DELETE /api/submissions/:id  (admin)
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const doc = await Submission.findById(req.params.id);
    if (!doc || (req.query.semester && doc.semester !== req.query.semester && !(req.query.semester === 'ODD' && !doc.semester))) {
      logger.warn('Submission not found for deletion or semester mismatch', { id: req.params.id, userId: req.user.id });
      return sendNotFound(res, 'Submission not found.');
    }
    await Submission.findByIdAndDelete(req.params.id);
    logger.info('Submission deleted', { id: req.params.id, empId: doc.empId, userId: req.user.id });
    wsHandler.broadcast({
      type: 'submissions_updated',
      data: { action: 'delete', empId: doc.empId, id: req.params.id }
    });
    sendSuccess(res, { message: 'Submission deleted.' }, 200);
  } catch (err) { 
    logger.error('Error deleting submission', { error: err.message, id: req.params.id, userId: req.user.id });
    next(err); 
  }
});

module.exports = router;

