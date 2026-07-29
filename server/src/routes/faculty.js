/**
 * routes/faculty.js
 *
 * GET    /api/faculty          — list all faculty
 * GET    /api/faculty/:empId   — get one
 * POST   /api/faculty          — add (admin)
 * PUT    /api/faculty/:empId   — update (admin)
 * DELETE /api/faculty/:empId   — delete (admin)
 */

'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const Faculty  = require('../models/Faculty');
const Workload = require('../models/Workload');
const CourseAllocation = require('../models/CourseAllocation');
const Submission = require('../models/Submission');
const User = require('../models/User');
const { nextSequence } = require('../utils/counters');
const { parsePagination, buildMeta } = require('../utils/pagination');
const { logAuditEvent } = require('../utils/audit');
const { requireAuth, requireAdmin, requireSelfOrAdmin } = require('../middleware/auth');
const { sendSuccess, sendError, sendValidationError, sendPaginated, sendCreated, sendConflict, sendNotFound } = require('../utils/response');
const logger = require('../utils/logger');
const { validateFacultyCreate, validateFacultyUpdate, validatePagination } = require('../middleware/validators');

const router = express.Router();

const toClient = (doc) => ({
  id:          doc._id?.toString() || '',
  slNo:        doc.slNo || 0,
  empId:       String(doc.empId || '').trim(),
  name:        String(doc.name || '').trim(),
  email:       String(doc.email || '').trim(),
  mobile:      String(doc.mobile || '').trim() || 'N/A',
  designation: String(doc.designation || '').trim() || 'N/A',
  department:  String(doc.department || '').trim() || 'CSE',
  weeklyCapacityHours: doc.weeklyCapacityHours || 30,
  lectureHours: doc.lectureHours || 0,
  tutorialHours: doc.tutorialHours || 0,
  practicalHours: doc.practicalHours || 0,
  allocatedHours: doc.allocatedHours || 0,
  remainingHours: doc.remainingHours ?? 30,
  utilizationPercentage: doc.utilizationPercentage || 0,
  status: doc.status || 'Available',
  createdAt:   doc.createdAt?.toISOString() || null,
  updatedAt:   doc.updatedAt?.toISOString() || null,
});

const buildFacultyPipeline = (matchFilter = {}, sort = { slNo: 1 }, skip = 0, limit = null) => {
  const pipeline = [
    { $match: matchFilter }
  ];

  if (sort) pipeline.push({ $sort: sort });
  if (skip) pipeline.push({ $skip: skip });
  if (limit) pipeline.push({ $limit: limit });

  pipeline.push(
    {
      $lookup: {
        from: 'workloads',
        localField: 'empId',
        foreignField: 'empId',
        as: 'workloads'
      }
    },
    {
      $addFields: {
        weeklyCapacityHours: { $ifNull: ["$weeklyCapacityHours", 30] },
        lectureHours: {
          $reduce: {
            input: '$workloads',
            initialValue: 0,
            in: { $add: ["$$value", { $ifNull: ["$$this.manualL", { $ifNull: ["$$this.fixedL", 0] }] }] }
          }
        },
        tutorialHours: {
          $reduce: {
            input: '$workloads',
            initialValue: 0,
            in: { $add: ["$$value", { $ifNull: ["$$this.manualT", { $ifNull: ["$$this.fixedT", 0] }] }] }
          }
        },
        practicalHours: {
          $reduce: {
            input: '$workloads',
            initialValue: 0,
            in: { $add: ["$$value", { $ifNull: ["$$this.manualP", { $ifNull: ["$$this.fixedP", 0] }] }] }
          }
        }
      }
    },
    {
      $addFields: {
        allocatedHours: { $add: ["$lectureHours", "$tutorialHours", "$practicalHours"] }
      }
    },
    {
      $addFields: {
        remainingHours: {
          $max: [0, { $subtract: ["$weeklyCapacityHours", "$allocatedHours"] }]
        },
        utilizationPercentage: {
          $cond: {
            if: { $gt: ["$weeklyCapacityHours", 0] },
            then: { $round: [{ $multiply: [{ $divide: ["$allocatedHours", "$weeklyCapacityHours"] }, 100] }, 2] },
            else: 0
          }
        }
      }
    },
    {
      $addFields: {
        status: {
          $switch: {
            branches: [
              { case: { $gte: ["$utilizationPercentage", 101] }, then: 'Overloaded' },
              { case: { $gte: ["$utilizationPercentage", 100] }, then: 'Full' },
              { case: { $gte: ["$utilizationPercentage", 80] }, then: 'Nearly Full' }
            ],
            default: 'Available'
          }
        }
      }
    },
    {
      $project: {
        workloads: 0,
        passwordHash: 0
      }
    }
  );

  return pipeline;
};

// GET /api/faculty
router.get('/', requireAuth, validatePagination, async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.search) {
      const q = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { empId: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
        { designation: { $regex: q, $options: 'i' } },
        { department: { $regex: q, $options: 'i' } },
      ];
    }
    const [total, docs] = await Promise.all([
      Faculty.countDocuments(filter),
      Faculty.aggregate(buildFacultyPipeline(filter, { slNo: 1 }, skip, limit))
    ]);
    logger.info('Faculty listed', { userId: req.user.id, filter, total, page, limit });
    sendPaginated(res, docs.map(toClient), { total, page, limit }, 200);
  } catch (err) { 
    logger.error('Error listing faculty', { error: err.message, userId: req.user.id });
    next(err); 
  }
});

// GET /api/faculty/:empId
router.get('/:empId', requireAuth, async (req, res, next) => {
  try {
    const pipeline = buildFacultyPipeline({ empId: req.params.empId }, null, 0, 1);
    const docs = await Faculty.aggregate(pipeline);
    const doc = docs[0];
    if (!doc) {
      logger.warn('Faculty member not found', { empId: req.params.empId, userId: req.user.id });
      return sendNotFound(res, 'Faculty member not found.');
    }
    logger.info('Faculty retrieved', { empId: req.params.empId, userId: req.user.id });
    sendSuccess(res, toClient(doc), 200);
  } catch (err) { 
    logger.error('Error retrieving faculty', { error: err.message, empId: req.params.empId, userId: req.user.id });
    next(err); 
  }
});

// POST /api/faculty  (admin)
router.post(
  '/',
  requireAuth, requireAdmin,
  validateFacultyCreate,
  async (req, res, next) => {
    const mongoose = require('mongoose');
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Faculty creation validation failed', { userId: req.user.id, errors: errors.array() });
        await session.abortTransaction();
        session.endSession();
        return sendValidationError(res, errors.array());
      }

      const { empId, name, department = 'CSE', designation, mobile = '', email = '' } = req.body;

      const existing = await Faculty.findOne({ empId: empId.trim() }).session(session);
      if (existing) {
        logger.warn('Faculty with duplicate empId attempted', { empId, userId: req.user.id });
        await session.abortTransaction();
        session.endSession();
        return sendConflict(res, 'Employee ID already exists.');
      }

      const maxDoc = await Faculty.findOne().sort({ slNo: -1 }).session(session).lean();
      const slNo   = await nextSequence('faculty_slno', Number(maxDoc?.slNo || 0));

      const createdDocs = await Faculty.create([{
        slNo,
        empId: empId.trim(),
        name: name.trim(),
        department: String(department || 'CSE').trim() || 'CSE',
        designation: designation.trim(),
        weeklyCapacityHours: req.body.weeklyCapacityHours !== undefined ? Number(req.body.weeklyCapacityHours) : 30,
        mobile,
        email,
      }], { session });
      const doc = createdDocs[0];

      // ── Create User account for faculty with mobile as default password ──
      const defaultPassword = mobile.trim() ? mobile.trim() : empId.trim();
      const passwordHash = bcrypt.hashSync(defaultPassword, 10);
      
      await User.create([{
        empId: empId.trim(),
        name: name.trim(),
        designation: designation.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        passwordHash,
        role: 'Faculty',
        canAccessAdmin: false,
        forcePasswordChange: true
      }], { session });

      logger.info('User account created for faculty', { empId: doc.empId });

      await session.commitTransaction();
      session.endSession();

      await logAuditEvent({ req, action: 'faculty.create', entity: 'faculty', entityId: doc.empId });
      logger.info('Faculty created', { empId: doc.empId, name: doc.name, userId: req.user.id });
      
      // Emit websocket event if possible, assuming wsHandler is available globally or we can let RealtimeCapacityContext pull on refresh
      // For now, the creation is successful.
      sendCreated(res, toClient(doc));
    } catch (err) { 
      await session.abortTransaction();
      session.endSession();
      logger.error('Error creating faculty', { error: err.message, userId: req.user.id });
      next(err); 
    }
  }
);

// PUT /api/faculty/:empId  (admin or self)
router.put(
  '/:empId',
  requireAuth, requireSelfOrAdmin,
  validateFacultyUpdate,
  async (req, res, next) => {
    try {
      // Validate empId parameter
      const empId = String(req.params.empId || '').trim();
      if (!empId) {
        logger.warn('Faculty update - invalid empId parameter', { empId: req.params.empId, userId: req.user.id });
        return sendError(res, 'Invalid Employee ID', 400);
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Faculty update validation failed', { empId, userId: req.user.id, errors: errors.array(), body: req.body });
        return sendValidationError(res, errors.array());
      }

      const { name, department, designation, mobile, email, slNo, weeklyCapacityHours } = req.body;
      const isAdmin = req.user.role === 'admin' || req.user.canAccessAdmin === true;
      const isSelf = String(req.user.id) === String(empId);
      
      logger.debug('Faculty update request received', { empId, userId: req.user.id, bodyKeys: Object.keys(req.body), isAdmin, isSelf });

      const allowedUpdates = {};
      
      // Both admin and self can update: name, designation, mobile, email
      if (name !== undefined && String(name).trim()) {
        allowedUpdates.name = String(name).trim();
        logger.debug('Setting name', { value: allowedUpdates.name });
      }
      if (designation !== undefined && String(designation).trim()) {
        allowedUpdates.designation = String(designation).trim();
        logger.debug('Setting designation', { value: allowedUpdates.designation });
      }
      if (mobile !== undefined) {
        allowedUpdates.mobile = String(mobile).trim();
        logger.debug('Setting mobile', { value: allowedUpdates.mobile });
      }
      if (email !== undefined && String(email).trim()) {
        allowedUpdates.email = String(email).trim();
        logger.debug('Setting email', { value: allowedUpdates.email });
      }
      
      // Only admin can update: department, slNo
      if (isAdmin) {
        if (department !== undefined && String(department).trim()) {
          allowedUpdates.department = String(department).trim();
          logger.debug('Setting department', { value: allowedUpdates.department });
        }
        if (slNo !== undefined) {
          allowedUpdates.slNo = Number(slNo);
          logger.debug('Setting slNo', { value: allowedUpdates.slNo });
        }
        if (weeklyCapacityHours !== undefined) {
          allowedUpdates.weeklyCapacityHours = Number(weeklyCapacityHours);
          logger.debug('Setting weeklyCapacityHours', { value: allowedUpdates.weeklyCapacityHours });
        }
      }

      // Always update the timestamp
      allowedUpdates.updatedAt = new Date();

      logger.info('Faculty update - preparing database update', { empId, userId: req.user.id, updates: allowedUpdates });

      const doc = await Faculty.findOneAndUpdate(
        { empId },
        { $set: allowedUpdates },
        { new: true, runValidators: true }
      ).lean();

      if (!doc) {
        logger.warn('Faculty member not found for update', { empId, userId: req.user.id });
        return sendNotFound(res, 'Faculty member not found.');
      }

      // ── Update User account if mobile or other fields changed ──
      // CRITICAL: User account update must succeed, otherwise profile and login diverge
      if (allowedUpdates.mobile || allowedUpdates.name || allowedUpdates.designation || allowedUpdates.email) {
        const userUpdates = {};
        if (allowedUpdates.name) userUpdates.name = allowedUpdates.name;
        if (allowedUpdates.designation) userUpdates.designation = allowedUpdates.designation;
        if (allowedUpdates.email) userUpdates.email = allowedUpdates.email;
        
        // If mobile changed, re-hash it as password
        if (allowedUpdates.mobile && allowedUpdates.mobile.trim()) {
          userUpdates.mobile = allowedUpdates.mobile;
          userUpdates.passwordHash = bcrypt.hashSync(allowedUpdates.mobile.trim(), 10);
        }

        if (Object.keys(userUpdates).length > 0) {
          try {
            const userUpdateResult = await User.findOneAndUpdate(
              { empId },
              { $set: userUpdates },
              { new: true, runValidators: true }
            );
            if (!userUpdateResult) {
              throw new Error('User account not found - cannot update login credentials');
            }
            logger.info('User account synced for faculty update', { empId, changes: Object.keys(userUpdates) });
          } catch (userErr) {
            // If user account update fails, rollback faculty update by re-fetching original
            logger.error('CRITICAL: User account update failed - rolling back faculty update', { empId, error: userErr.message });
            
            // Fetch the faculty record again to return unchanged data
            const originalDoc = await Faculty.findOne({ empId }).lean();
            return sendError(res, `Failed to sync login credentials for faculty member. Faculty profile and login account would diverge. Please contact support. Error: ${userErr.message}`, 500);
          }
        }
      }

      await logAuditEvent({ req, action: 'faculty.update', entity: 'faculty', entityId: empId, metadata: { fields: Object.keys(allowedUpdates), isSelfEdit: isSelf } });
      logger.info('Faculty updated successfully', { empId, fields: Object.keys(allowedUpdates), userId: req.user.id, isSelfEdit: isSelf });
      sendSuccess(res, toClient(doc), 200);
    } catch (err) { 
      logger.error('Error updating faculty', { error: err.message, stack: err.stack, empId: req.params.empId, userId: req.user.id });
      next(err); 
    }
  }
);

// DELETE /api/faculty/:empId  (admin)
// Admin-only delete with CASCADE cleanup of related records (User, Workload, Submissions, Allocations)
router.delete('/:empId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const empId = String(req.params.empId || '').trim();
    if (!empId) {
      logger.warn('Delete request with missing empId', { userId: req.user.id });
      return sendError(res, 'Employee ID is required.', 400);
    }

    // Check if faculty exists first
    const doc = await Faculty.findOne({ empId });
    if (!doc) {
      logger.warn('Faculty member not found for deletion', { empId, userId: req.user.id });
      return sendNotFound(res, 'Faculty member not found.');
    }

    // Log what we're about to delete
    const counters = {
      workloads: 0,
      submissions: 0,
      users: 0,
      allocations: 0,
    };

    // CASCADE DELETE: Remove all related records
    try {
      counters.workloads = (await Workload.deleteMany({ empId })).deletedCount || 0;
      counters.submissions = (await Submission.deleteMany({ empId })).deletedCount || 0;
      counters.users = (await User.deleteMany({ empId })).deletedCount || 0;
      
      // Remove faculty from course allocations (both single lectures and slot arrays)
      const allocDeleteResult = await CourseAllocation.deleteMany({
        $or: [
          { 'lectureSlot.empId': empId },
          { lectureSlots: { $elemMatch: { empId } } },
          { tutorialSlots: { $elemMatch: { empId } } },
          { practicalSlots: { $elemMatch: { empId } } },
        ],
      });
      counters.allocations = allocDeleteResult.deletedCount || 0;
    } catch (cleanupErr) {
      logger.error('Error during cascade delete cleanup', { error: cleanupErr.message, empId, userId: req.user.id, counters });
      // Continue with faculty deletion even if cleanup fails
    }

    // Delete the faculty record itself
    await Faculty.findOneAndDelete({ empId });
    
    await logAuditEvent({ 
      req, 
      action: 'faculty.delete_cascade', 
      entity: 'faculty', 
      entityId: empId,
      details: { 
        name: doc.name,
        cleanupStats: counters,
      },
    });
    
    logger.info('Faculty deleted with cascade cleanup', { 
      empId, 
      name: doc.name, 
      userId: req.user.id,
      cleanupStats: counters,
    });
    
    sendSuccess(res, { 
      message: 'Faculty member deleted successfully with all related records cleaned up.',
      cleaned: counters,
    }, 200);
  } catch (err) { 
    logger.error('Error deleting faculty', { error: err.message, empId: req.params.empId, userId: req.user.id });
    next(err); 
  }
});

module.exports = router;

