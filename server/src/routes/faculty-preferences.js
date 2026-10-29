/**
 * routes/faculty-preferences.js
 *
 * Handles faculty course preferences for workload assignment filtering
 *
 * GET    /deva/faculty-preferences/:empId  — Get preferences for a faculty
 * GET    /deva/faculty-preferences/:empId/courses  — Get courses (filtered or all)
 * POST   /deva/faculty-preferences  — Save/update faculty preferences
 * PUT    /deva/faculty-preferences/:empId  — Update existing preferences
 * DELETE /deva/faculty-preferences/:empId  — Clear preferences
 */

'use strict';

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const FacultyPreference = require('../models/FacultyPreference');
const Submission = require('../models/Submission');
const Faculty = require('../models/Faculty');
const Course = require('../models/Course');
const { requireAuth, requireAdmin, requireSelfOrAdmin } = require('../middleware/auth');
const { sendSuccess, sendError, sendValidationError, sendNotFound, sendCreated, sendConflict } = require('../utils/response');
const { normalizeYear, resolveCourseYear } = require('../utils/courseUtils');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /deva/faculty-preferences/:empId
 * 
 * Fetch faculty preferences
 * Checks Submission collection first (scoped by academicYear and semester if provided),
 * then falls back to FacultyPreference collection.
 * Returns: { success, data: { empId, preferredCourseIds, preferredCourses, isSubmitted, submittedAt, notes, academicYear, semester } }
 * 
 * IMPORTANT: Does NOT require faculty to exist in Faculty collection
 * - If preferences found in Submission → return them with resolved course years
 * - If preferences found in FacultyPreference → return them with resolved course years
 * - Otherwise → return empty preferences (not 404)
 */
router.get(
  '/:empId',
  [param('empId').trim().isLength({ min: 1 }).withMessage('Employee ID required')],
  requireAuth,
  requireSelfOrAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array());
      }

      const { empId } = req.params;
      const { semester, academicYear } = req.query;

      // Build scoped query for Submission collection
      const submissionQuery = { empId };
      if (academicYear) {
        submissionQuery.academicYear = String(academicYear).trim();
      }
      if (semester) {
        submissionQuery.semester = String(semester).trim().toUpperCase();
      }

      // CHECK SUBMISSION COLLECTION FIRST (actual preferences)
      let submission = await Submission.findOne(submissionQuery).sort({ updatedAt: -1, createdAt: -1 });

      // If not found with exact filter, and no period filter was specified, fall back to most recent submission
      if (!submission && !academicYear && !semester) {
        submission = await Submission.findOne({ empId }).sort({ updatedAt: -1, createdAt: -1 });
      }

      if (submission && submission.prefs && submission.prefs.length > 0) {
        logger.debug(`Found preferences in Submission for ${empId}: ${submission.prefs.length} courses`);

        // Fetch course documents to populate resolved course years and metadata
        const courseQuery = {
          courseId: { $in: submission.prefs },
          isDeleted: { $ne: true },
        };
        if (submission.academicYear) {
          courseQuery.academicYear = submission.academicYear;
        }
        if (submission.semester) {
          courseQuery.semester = submission.semester;
        }

        let foundCourses = await Course.find(courseQuery).sort({ year: 1, subjectCode: 1 }).lean();
        if (foundCourses.length === 0) {
          // If no courses found with academic period filter, fallback without period filter
          foundCourses = await Course.find({
            courseId: { $in: submission.prefs },
            isDeleted: { $ne: true },
          }).sort({ year: 1, subjectCode: 1 }).lean();
        }

        const preferredCourses = foundCourses.map((c) => ({
          id: String(c.courseId || 0),
          courseId: Number(c.courseId || 0),
          program: String(c.program || '').trim() || 'N/A',
          courseType: String(c.courseType || '').trim() || 'Other',
          year: resolveCourseYear(c),
          subjectCode: String(c.subjectCode || '').trim(),
          subjectName: String(c.subjectName || '').trim(),
          shortName: String(c.shortName || '').trim(),
          L: Number(c.L || 0),
          T: Number(c.T || 0),
          P: Number(c.P || 0),
          C: Number(c.C || 0),
          academicYear: String(c.academicYear || '').trim(),
          semester: String(c.semester || '').trim(),
        }));

        return sendSuccess(res, {
          empId,
          preferredCourseIds: submission.prefs || [],
          preferredCourses,
          isSubmitted: true,
          submittedAt: submission.updatedAt || submission.createdAt || new Date(),
          academicYear: submission.academicYear || academicYear || '',
          semester: submission.semester || semester || '',
          notes: '',
        });
      }

      // FALLBACK to FacultyPreference collection if nothing in Submission
      let preferences = await FacultyPreference.findOne({ empId });
      if (preferences && preferences.preferredCourseIds && preferences.preferredCourseIds.length > 0) {
        logger.debug(`Found preferences in FacultyPreference for ${empId}: ${preferences.preferredCourseIds.length} courses`);

        const foundCourses = await Course.find({
          courseId: { $in: preferences.preferredCourseIds },
          isDeleted: { $ne: true },
        }).sort({ year: 1, subjectCode: 1 }).lean();

        const preferredCourses = foundCourses.map((c) => ({
          id: String(c.courseId || 0),
          courseId: Number(c.courseId || 0),
          program: String(c.program || '').trim() || 'N/A',
          courseType: String(c.courseType || '').trim() || 'Other',
          year: resolveCourseYear(c),
          subjectCode: String(c.subjectCode || '').trim(),
          subjectName: String(c.subjectName || '').trim(),
          shortName: String(c.shortName || '').trim(),
          L: Number(c.L || 0),
          T: Number(c.T || 0),
          P: Number(c.P || 0),
          C: Number(c.C || 0),
          academicYear: String(c.academicYear || '').trim(),
          semester: String(c.semester || '').trim(),
        }));

        return sendSuccess(res, {
          empId: preferences.empId,
          preferredCourseIds: preferences.preferredCourseIds || [],
          preferredCourses,
          isSubmitted: preferences.isSubmitted,
          submittedAt: preferences.submittedAt,
          academicYear: academicYear || '',
          semester: semester || '',
          notes: preferences.notes || '',
        });
      }

      // NO preferences found in either collection - return empty prefs (not 404)
      // This allows workload assignment even if faculty hasn't submitted preferences yet
      logger.debug(`No preferences found for ${empId} - returning empty preferences`);
      return sendSuccess(res, {
        empId,
        preferredCourseIds: [],
        preferredCourses: [],
        isSubmitted: false,
        submittedAt: null,
        academicYear: academicYear || '',
        semester: semester || '',
        notes: '',
        message: 'No preferences submitted yet',
      });
    } catch (err) {
      logger.error('Error fetching faculty preferences:', err);
      sendError(res, 'Failed to fetch preferences', 500);
    }
  }
);

/**
 * GET /deva/faculty-preferences/:empId/courses
 * 
 * Get course list for assignment
 * - If faculty has submitted preferences: Return ONLY preferred courses
 * - If faculty has NOT submitted preferences: Return ALL available courses
 * 
 * Query params:
 *   - year: Filter by year (I, II, III, IV, M.Tech_I, etc.)
 *   - courseType: Filter by course type (Mandatory, Department Elective, etc.)
 *   - academicYear: Filter by academic year (e.g. 2025-2026)
 *   - semester: Filter by semester (ODD, EVEN)
 */
router.get(
  '/:empId/courses',
  [param('empId').trim().isLength({ min: 1 }).withMessage('Employee ID required')],
  requireAuth,
  requireSelfOrAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array());
      }

      const { empId } = req.params;
      const { year, courseType, semester, academicYear } = req.query;

      // Check if faculty exists
      const faculty = await Faculty.findOne({ empId });
      if (!faculty) {
        return sendNotFound(res, `Faculty with empId ${empId} not found`);
      }

      // Scoped search for Submission
      const subQuery = { empId };
      if (academicYear) subQuery.academicYear = String(academicYear).trim();
      if (semester) subQuery.semester = String(semester).trim().toUpperCase();

      let submission = await Submission.findOne(subQuery).sort({ updatedAt: -1, createdAt: -1 });
      if (!submission && !academicYear && !semester) {
        submission = await Submission.findOne({ empId }).sort({ updatedAt: -1, createdAt: -1 });
      }

      let preferences = null;
      let preferredCourseIds = [];
      let isSubmitted = false;

      if (submission && submission.prefs && submission.prefs.length > 0) {
        // Found preferences in Submission collection
        preferredCourseIds = submission.prefs;
        isSubmitted = true;
      } else {
        // Check FacultyPreference collection
        preferences = await FacultyPreference.findOne({ empId });
        if (preferences && preferences.isSubmitted && preferences.preferredCourseIds && preferences.preferredCourseIds.length > 0) {
          preferredCourseIds = preferences.preferredCourseIds;
          isSubmitted = true;
        }
      }

      // Build base query for courses
      let courseQuery = { isDeleted: { $ne: true } };

      // Apply academicYear filter if provided
      if (academicYear) {
        courseQuery.academicYear = String(academicYear).trim();
      }

      // Apply semester filter if provided
      if (semester) {
        courseQuery.semester = String(semester).trim().toUpperCase();
      }

      // Apply year filter if provided
      if (year) {
        courseQuery.year = normalizeYear(year);
      }

      // Apply course type filter if provided
      if (courseType) {
        courseQuery.courseType = String(courseType).trim();
      }

      // Determine which courses to return
      if (isSubmitted && preferredCourseIds.length > 0) {
        // Faculty has submitted preferences: Return ONLY preferred courses
        courseQuery.courseId = { $in: preferredCourseIds };
      }

      // Fetch courses
      let courses = await Course.find(courseQuery).sort({ year: 1, subjectCode: 1 }).lean();

      // If preferred courses not found with strict period filter, relax period filter to ensure preferences are returned
      if (courses.length === 0 && isSubmitted && preferredCourseIds.length > 0 && (academicYear || semester)) {
        const relaxedQuery = {
          courseId: { $in: preferredCourseIds },
          isDeleted: { $ne: true }
        };
        if (year) relaxedQuery.year = normalizeYear(year);
        if (courseType) relaxedQuery.courseType = String(courseType).trim();
        const fallbackCourses = await Course.find(relaxedQuery).sort({ year: 1, subjectCode: 1 }).lean();
        if (fallbackCourses.length > 0) {
          courses = fallbackCourses;
        }
      }

      // Transform to client format with dynamically resolved course year
      const transformedCourses = courses.map((course) => ({
        id: String(course.courseId || 0),
        courseId: Number(course.courseId || 0),
        program: String(course.program || '').trim() || 'N/A',
        courseType: String(course.courseType || '').trim() || 'Other',
        year: resolveCourseYear(course),
        subjectCode: String(course.subjectCode || '').trim(),
        subjectName: String(course.subjectName || '').trim(),
        shortName: String(course.shortName || '').trim(),
        L: Number(course.L || 0),
        T: Number(course.T || 0),
        P: Number(course.P || 0),
        C: Number(course.C || 0),
        academicYear: String(course.academicYear || '').trim(),
        semester: String(course.semester || '').trim(),
      }));

      return sendSuccess(res, {
        empId,
        hasPreferences: isSubmitted && preferredCourseIds.length > 0,
        preferredCourseIds: preferredCourseIds || [],
        courses: transformedCourses,
        totalCount: transformedCourses.length,
        message: isSubmitted
          ? `Showing ${transformedCourses.length} preferred courses`
          : `Showing all ${transformedCourses.length} available courses (no preferences submitted)`,
      });
    } catch (err) {
      logger.error('Error fetching filtered courses:', err);
      sendError(res, 'Failed to fetch courses', 500);
    }
  }
);

/**
 * POST /deva/faculty-preferences
 * 
 * Create or update faculty preferences
 * Body: { empId, preferredCourseIds: [courseIds], notes (optional), semester (optional), academicYear (optional) }
 */
router.post(
  '/',
  [
    body('empId').trim().isLength({ min: 1 }).withMessage('Employee ID required'),
    body('preferredCourseIds')
      .isArray({ min: 1 })
      .withMessage('At least one course must be selected'),
    body('preferredCourseIds.*').isInt().withMessage('Each course ID must be a number'),
    body('notes').optional().trim(),
    body('semester').optional().trim(),
    body('academicYear').optional().trim(),
  ],
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array());
      }

      const { empId, preferredCourseIds, notes = '', semester = '', academicYear = '' } = req.body;

      // Validate faculty exists
      const faculty = await Faculty.findOne({ empId });
      if (!faculty) {
        return sendNotFound(res, `Faculty with empId ${empId} not found`);
      }

      // Validate all courses exist
      const courseIds = Array.isArray(preferredCourseIds) ? preferredCourseIds : [preferredCourseIds];
      const existingCourses = await Course.find({ courseId: { $in: courseIds } }).lean();

      if (existingCourses.length !== courseIds.length) {
        return sendConflict(res, 'One or more course IDs do not exist');
      }

      // Create or update preferences in FacultyPreference
      const preferences = await FacultyPreference.findOneAndUpdate(
        { empId },
        {
          empId,
          preferredCourseIds: courseIds,
          isSubmitted: true,
          submittedAt: new Date(),
          notes,
        },
        { upsert: true, new: true }
      );

      // If academicYear and semester are provided, sync with Submission collection
      if (academicYear && semester) {
        await Submission.findOneAndUpdate(
          { empId, academicYear, semester: semester.toUpperCase() },
          {
            empId,
            empName: faculty.name,
            designation: faculty.designation,
            mobile: faculty.mobile || '',
            prefs: courseIds,
            semester: semester.toUpperCase(),
            academicYear,
          },
          { upsert: true, new: true }
        );
      }

      return sendCreated(res, {
        empId: preferences.empId,
        preferredCourseIds: preferences.preferredCourseIds,
        isSubmitted: preferences.isSubmitted,
        submittedAt: preferences.submittedAt,
        notes: preferences.notes,
        message: 'Preferences saved successfully',
      });
    } catch (err) {
      logger.error('Error saving faculty preferences:', err);
      sendError(res, 'Failed to save preferences', 500);
    }
  }
);

/**
 * PUT /deva/faculty-preferences/:empId
 * 
 * Update existing preferences
 * Body: { preferredCourseIds: [courseIds], notes (optional), semester (optional), academicYear (optional) }
 */
router.put(
  '/:empId',
  [
    param('empId').trim().isLength({ min: 1 }).withMessage('Employee ID required'),
    body('preferredCourseIds')
      .optional()
      .isArray()
      .withMessage('preferredCourseIds must be an array'),
    body('preferredCourseIds.*').optional().isInt().withMessage('Each course ID must be a number'),
    body('notes').optional().trim(),
    body('semester').optional().trim(),
    body('academicYear').optional().trim(),
  ],
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array());
      }

      const { empId } = req.params;
      const { preferredCourseIds, notes, semester, academicYear } = req.body;

      // Validate faculty exists
      const faculty = await Faculty.findOne({ empId });
      if (!faculty) {
        return sendNotFound(res, `Faculty with empId ${empId} not found`);
      }

      // Fetch existing preferences
      const preferences = await FacultyPreference.findOne({ empId });
      if (!preferences) {
        return sendNotFound(res, `No preferences found for faculty ${empId}`);
      }

      // Build update object
      const updateData = {};

      if (preferredCourseIds && Array.isArray(preferredCourseIds) && preferredCourseIds.length > 0) {
        // Validate all courses exist
        const existingCourses = await Course.find({ courseId: { $in: preferredCourseIds } }).lean();
        if (existingCourses.length !== preferredCourseIds.length) {
          return sendConflict(res, 'One or more course IDs do not exist');
        }
        updateData.preferredCourseIds = preferredCourseIds;
        updateData.submittedAt = new Date();
      }

      if (notes !== undefined) {
        updateData.notes = notes;
      }

      const updatedPreferences = await FacultyPreference.findOneAndUpdate(
        { empId },
        updateData,
        { new: true }
      );

      // If academicYear and semester are provided, sync with Submission collection
      if (academicYear && semester && preferredCourseIds) {
        await Submission.findOneAndUpdate(
          { empId, academicYear, semester: semester.toUpperCase() },
          {
            empId,
            empName: faculty.name,
            designation: faculty.designation,
            mobile: faculty.mobile || '',
            prefs: preferredCourseIds,
            semester: semester.toUpperCase(),
            academicYear,
          },
          { upsert: true, new: true }
        );
      }

      return sendSuccess(res, {
        empId: updatedPreferences.empId,
        preferredCourseIds: updatedPreferences.preferredCourseIds,
        isSubmitted: updatedPreferences.isSubmitted,
        submittedAt: updatedPreferences.submittedAt,
        notes: updatedPreferences.notes,
        message: 'Preferences updated successfully',
      });
    } catch (err) {
      logger.error('Error updating faculty preferences:', err);
      sendError(res, 'Failed to update preferences', 500);
    }
  }
);

/**
 * DELETE /deva/faculty-preferences/:empId
 * 
 * Clear preferences for a faculty
 */
router.delete(
  '/:empId',
  [param('empId').trim().isLength({ min: 1 }).withMessage('Employee ID required')],
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array());
      }

      const { empId } = req.params;

      // Validate faculty exists
      const faculty = await Faculty.findOne({ empId });
      if (!faculty) {
        return sendNotFound(res, `Faculty with empId ${empId} not found`);
      }

      const preferences = await FacultyPreference.findOneAndDelete({ empId });
      if (!preferences) {
        return sendNotFound(res, `No preferences found for faculty ${empId}`);
      }

      return sendSuccess(res, {
        empId,
        message: 'Preferences deleted successfully',
      });
    } catch (err) {
      logger.error('Error deleting faculty preferences:', err);
      sendError(res, 'Failed to delete preferences', 500);
    }
  }
);

module.exports = router;
