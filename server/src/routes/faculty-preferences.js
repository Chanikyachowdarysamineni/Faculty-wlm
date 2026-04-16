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
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendSuccess, sendError, sendValidationError, sendNotFound, sendCreated, sendConflict } = require('../utils/response');
const { logAuditEvent } = require('../utils/audit');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /deva/faculty-preferences/:empId
 * 
 * Fetch faculty preferences
 * Checks Submission collection first (actual preferences), then FacultyPreference collection
 * Returns: { success, data: { empId, preferredCourseIds, isSubmitted, submittedAt, notes } }
 * 
 * IMPORTANT: Does NOT require faculty to exist in Faculty collection
 * - If preferences found in Submission → return them
 * - If preferences found in FacultyPreference → return them
 * - Otherwise → return empty preferences (not 404)
 */
router.get(
  '/:empId',
  [param('empId').trim().isLength({ min: 1 }).withMessage('Employee ID required')],
  requireAuth,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array());
      }

      const { empId } = req.params;

      // CHECK SUBMISSION COLLECTION FIRST (actual preferences)
      let submission = await Submission.findOne({ empId });
      if (submission && submission.prefs && submission.prefs.length > 0) {
        logger.debug(`Found preferences in Submission for ${empId}: ${submission.prefs.length} courses`);
        return sendSuccess(res, {
          empId,
          preferredCourseIds: submission.prefs || [],
          isSubmitted: true,
          submittedAt: submission.updatedAt || submission.createdAt || new Date(),
          notes: '',
        });
      }

      // FALLBACK to FacultyPreference collection if nothing in Submission
      let preferences = await FacultyPreference.findOne({ empId });
      if (preferences && preferences.preferredCourseIds && preferences.preferredCourseIds.length > 0) {
        logger.debug(`Found preferences in FacultyPreference for ${empId}: ${preferences.preferredCourseIds.length} courses`);
        return sendSuccess(res, {
          empId: preferences.empId,
          preferredCourseIds: preferences.preferredCourseIds || [],
          isSubmitted: preferences.isSubmitted,
          submittedAt: preferences.submittedAt,
          notes: preferences.notes || '',
        });
      }

      // NO preferences found in either collection - return empty prefs (not 404)
      // This allows workload assignment even if faculty hasn't submitted preferences yet
      logger.debug(`No preferences found for ${empId} - returning empty preferences`);
      return sendSuccess(res, {
        empId,
        preferredCourseIds: [],
        isSubmitted: false,
        submittedAt: null,
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
 *   - year: Filter by year (I, II, III, IV)
 *   - courseType: Filter by course type (Mandatory, Department Elective, etc.)
 */
router.get(
  '/:empId/courses',
  [param('empId').trim().isLength({ min: 1 }).withMessage('Employee ID required')],
  requireAuth,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array());
      }

      const { empId } = req.params;
      const { year, courseType } = req.query;

      // Check if faculty exists
      const faculty = await Faculty.findOne({ empId });
      if (!faculty) {
        return sendNotFound(res, `Faculty with empId ${empId} not found`);
      }

      // Fetch faculty preferences from Submission first, then FacultyPreference
      let submission = await Submission.findOne({ empId });
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
      let courseQuery = {};

      // Apply year filter if provided
      if (year) {
        courseQuery.year = String(year).trim();
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
      // else: Return ALL courses (no additional filter)

      // Fetch courses
      const courses = await Course.find(courseQuery).sort({ year: 1, subjectCode: 1 }).lean();

      // Transform to client format
      const transformedCourses = courses.map((course) => ({
        id: String(course.courseId || 0),
        program: String(course.program || '').trim() || 'B.Tech',
        courseType: String(course.courseType || '').trim(),
        year: String(course.year || '').trim(),
        subjectCode: String(course.subjectCode || '').trim(),
        subjectName: String(course.subjectName || '').trim(),
        shortName: String(course.shortName || '').trim(),
        L: Number(course.L || 0),
        T: Number(course.T || 0),
        P: Number(course.P || 0),
        C: Number(course.C || 0),
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
 * Body: { empId, preferredCourseIds: [courseIds], notes (optional) }
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
  ],
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array());
      }

      const { empId, preferredCourseIds, notes = '' } = req.body;

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

      // Create or update preferences
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

      // Log audit event
      await logAuditEvent({
        action: 'CREATE_FACULTY_PREFERENCE',
        userId: req.user?.id || 'system',
        description: `Faculty ${empId} submitted course preferences with ${courseIds.length} courses`,
        resourceId: empId,
        resourceType: 'FacultyPreference',
      });

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
 * Body: { preferredCourseIds: [courseIds], notes (optional) }
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
      const { preferredCourseIds, notes } = req.body;

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

      // Log audit event
      await logAuditEvent({
        action: 'UPDATE_FACULTY_PREFERENCE',
        userId: req.user?.id || 'system',
        description: `Faculty ${empId} preferences updated`,
        resourceId: empId,
        resourceType: 'FacultyPreference',
      });

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

      // Log audit event
      await logAuditEvent({
        action: 'DELETE_FACULTY_PREFERENCE',
        userId: req.user?.id || 'system',
        description: `Faculty ${empId} preferences deleted`,
        resourceId: empId,
        resourceType: 'FacultyPreference',
      });

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
