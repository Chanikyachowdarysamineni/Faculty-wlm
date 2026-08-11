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
const { mongoose } = require('../db');
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
  capacity:    doc.capacity ?? 18,
  lectureHours: doc.lectureHours || 0,
  tutorialHours: doc.tutorialHours || 0,
  practicalHours: doc.practicalHours || 0,
  allocated:   doc.allocated || 0,
  remaining:   doc.remaining ?? 18,
  workloadPercentage: doc.workloadPercentage || 0,
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
        capacity: { $ifNull: ["$capacity", 18] },
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
        allocated: { $add: ["$lectureHours", "$tutorialHours", "$practicalHours"] }
      }
    },
    {
      $addFields: {
        remaining: {
          $subtract: ["$capacity", "$allocated"]
        },
        workloadPercentage: {
          $cond: {
            if: { $gt: ["$capacity", 0] },
            then: { $round: [{ $multiply: [{ $divide: ["$allocated", "$capacity"] }, 100] }, 2] },
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
              { case: { $lt: ["$remaining", 0] }, then: 'Overloaded' },
              { case: { $eq: ["$remaining", 0] }, then: 'Full' },
              { case: { $gte: ["$workloadPercentage", 80] }, then: 'Nearly Full' }
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

// GET /api/faculty/deleted  (admin)
router.get('/deleted', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const docs = await Faculty.find({ isDeleted: true }).lean();
    sendSuccess(res, docs.map(toClient), 200);
  } catch (err) { next(err); }
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

      const {
        empId, name, department = 'CSE', designation, mobile = '', email = '', capacity,
        qualification = '', experience = 0, role = 'faculty', username = '',
        workingHours = '', joiningDate = null, address = '', gender = '',
        dob = null, profilePicture = '', researchArea = '', specialization = '',
        status = 'Available',
      } = req.body;

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
        capacity: capacity !== undefined ? Number(capacity) : 18,
        mobile,
        email,
        qualification: String(qualification || '').trim(),
        experience: Number(experience) || 0,
        role: String(role || 'faculty').trim(),
        username: String(username || '').trim(),
        workingHours: String(workingHours || '').trim(),
        joiningDate: joiningDate || null,
        address: String(address || '').trim(),
        gender: String(gender || '').trim(),
        dob: dob || null,
        profilePicture: String(profilePicture || '').trim(),
        researchArea: String(researchArea || '').trim(),
        specialization: String(specialization || '').trim(),
        status: String(status || 'Available').trim(),
      }], { session });
      const doc = createdDocs[0];

      // ── Create User account for faculty with mobile as default password ──
      const defaultPassword = mobile.trim() ? mobile.trim() : empId.trim();
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      
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
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const empId = String(req.params.empId || '').trim();
      if (!empId) {
        await session.abortTransaction();
        session.endSession();
        return sendError(res, 'Invalid Employee ID', 400);
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await session.abortTransaction();
        session.endSession();
        return sendValidationError(res, errors.array());
      }

      const {
        name, department, designation, mobile, email, slNo, capacity,
        status, role, username, qualification, experience,
        workingHours, joiningDate, address, gender, dob,
        profilePicture, researchArea, specialization,
      } = req.body;
      const isAdmin = req.user.role === 'admin' || req.user.canAccessAdmin === true;
      const isSelf = String(req.user.id) === String(empId);
      
      const allowedUpdates = {};
      if (name !== undefined && String(name).trim()) allowedUpdates.name = String(name).trim();
      if (designation !== undefined && String(designation).trim()) allowedUpdates.designation = String(designation).trim();
      if (mobile !== undefined) allowedUpdates.mobile = String(mobile).trim();
      if (email !== undefined && String(email).trim()) allowedUpdates.email = String(email).trim();
      
      if (isAdmin) {
        if (department !== undefined && String(department).trim()) allowedUpdates.department = String(department).trim();
        if (slNo !== undefined) allowedUpdates.slNo = Number(slNo);
        if (capacity !== undefined) allowedUpdates.capacity = Number(capacity);
        if (status !== undefined) allowedUpdates.status = String(status).trim();
        if (role !== undefined) allowedUpdates.role = String(role).trim();
        if (username !== undefined) allowedUpdates.username = String(username).trim();
      }

      if (qualification !== undefined) allowedUpdates.qualification = String(qualification).trim();
      if (experience !== undefined) allowedUpdates.experience = Number(experience);
      if (workingHours !== undefined) allowedUpdates.workingHours = String(workingHours).trim();
      if (joiningDate !== undefined) allowedUpdates.joiningDate = joiningDate;
      if (address !== undefined) allowedUpdates.address = String(address).trim();
      if (gender !== undefined) allowedUpdates.gender = String(gender).trim();
      if (dob !== undefined) allowedUpdates.dob = dob;
      if (profilePicture !== undefined) allowedUpdates.profilePicture = String(profilePicture).trim();
      if (researchArea !== undefined) allowedUpdates.researchArea = String(researchArea).trim();
      if (specialization !== undefined) allowedUpdates.specialization = String(specialization).trim();

      allowedUpdates.updatedAt = new Date();

      const doc = await Faculty.findOneAndUpdate(
        { empId },
        { $set: allowedUpdates },
        { new: true, runValidators: true, session }
      ).lean();

      if (!doc) {
        await session.abortTransaction();
        session.endSession();
        return sendNotFound(res, 'Faculty member not found.');
      }

      if (allowedUpdates.mobile || allowedUpdates.name || allowedUpdates.designation || allowedUpdates.email) {
        const userUpdates = {};
        if (allowedUpdates.name) userUpdates.name = allowedUpdates.name;
        if (allowedUpdates.designation) userUpdates.designation = allowedUpdates.designation;
        if (allowedUpdates.email) userUpdates.email = allowedUpdates.email;
        if (allowedUpdates.mobile && allowedUpdates.mobile.trim()) {
          userUpdates.mobile = allowedUpdates.mobile;
          userUpdates.passwordHash = await bcrypt.hash(allowedUpdates.mobile.trim(), 10);
        }

        if (Object.keys(userUpdates).length > 0) {
          const userUpdateResult = await User.findOneAndUpdate(
            { empId },
            { $set: userUpdates },
            { new: true, runValidators: true, session }
          );
          if (!userUpdateResult) {
            await session.abortTransaction();
            session.endSession();
            return sendError(res, 'User account not found - cannot update login credentials', 500);
          }
        }
      }

      // M-5: Propagate name/designation changes to existing Workload records so they stay fresh
      const workloadUpdates = {};
      if (allowedUpdates.name) workloadUpdates.empName = allowedUpdates.name;
      if (allowedUpdates.designation) workloadUpdates.designation = allowedUpdates.designation;
      if (Object.keys(workloadUpdates).length > 0) {
        await Workload.updateMany({ empId }, { $set: workloadUpdates }, { session });
        logger.info('Propagated faculty name/designation to workload records', { empId, workloadUpdates });
      }

      await logAuditEvent({ req, action: 'faculty.update', entity: 'faculty', entityId: empId, metadata: { fields: Object.keys(allowedUpdates), isSelfEdit: isSelf } });
      
      await session.commitTransaction();
      session.endSession();

      // M-1: Re-fetch via aggregation pipeline so response reflects accurate computed capacity fields
      const freshPipeline = buildFacultyPipeline({ empId }, null, 0, 1);
      const freshDocs = await Faculty.aggregate(freshPipeline);
      const freshDoc = freshDocs[0] || doc;
      
      logger.info('Faculty updated successfully', { empId, fields: Object.keys(allowedUpdates), userId: req.user.id, isSelfEdit: isSelf });
      sendSuccess(res, toClient(freshDoc), 200);
    } catch (err) { 
      await session.abortTransaction();
      session.endSession();
      logger.error('Error updating faculty', { error: err.message, stack: err.stack, empId: req.params.empId, userId: req.user.id });
      next(err); 
    }
  }
);

// DELETE /api/faculty/:empId  (admin)
router.delete('/:empId', requireAuth, requireAdmin, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const empId = String(req.params.empId || '').trim();
    if (!empId) {
      await session.abortTransaction();
      session.endSession();
      return sendError(res, 'Employee ID is required.', 400);
    }

    const doc = await Faculty.findOneAndUpdate(
      { empId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true, session }
    );
    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      return sendNotFound(res, 'Faculty member not found.');
    }

    const counters = { workloads: 0, submissions: 0, users: 0, allocations: 0 };

    const wlRes = await Workload.updateMany({ empId, isDeleted: { $ne: true } }, { $set: { isDeleted: true, deletedAt: new Date() } }, { session });
    counters.workloads = wlRes.modifiedCount || 0;

    const subRes = await Submission.updateMany({ empId, isDeleted: { $ne: true } }, { $set: { isDeleted: true, deletedAt: new Date() } }, { session });
    counters.submissions = subRes.modifiedCount || 0;

    const userRes = await User.updateMany({ empId, isDeleted: { $ne: true } }, { $set: { isDeleted: true, deletedAt: new Date() } }, { session });
    counters.users = userRes.modifiedCount || 0;
      
    const allocations = await CourseAllocation.find({
      $or: [
        { 'lectureSlot.empId': empId },
        { lectureSlots: { $elemMatch: { empId } } },
        { tutorialSlots: { $elemMatch: { empId } } },
        { practicalSlots: { $elemMatch: { empId } } },
      ],
    }).session(session);
    
    for (const alloc of allocations) {
      if (alloc.lectureSlot && alloc.lectureSlot.empId === empId) {
        alloc.lectureSlot = { empId: '', empName: '', designation: '', hours: 0 };
      }
      const clearSlot = (slot) => {
        if (slot.empId === empId) { slot.empId = ''; slot.empName = ''; slot.designation = ''; slot.hours = 0; }
      };
      alloc.lectureSlots.forEach(clearSlot);
      alloc.tutorialSlots.forEach(clearSlot);
      alloc.practicalSlots.forEach(clearSlot);
      await alloc.save({ session });
    }
    counters.allocations = allocations.length;

    await logAuditEvent({ req, action: 'faculty.delete_soft', entity: 'faculty', entityId: empId, details: { name: doc.name, cleanupStats: counters } });
    
    await session.commitTransaction();
    session.endSession();
    
    logger.info('Faculty soft deleted with cascade cleanup', { empId, name: doc.name, userId: req.user.id, cleanupStats: counters });
    sendSuccess(res, { message: 'Faculty member deleted successfully.', cleaned: counters }, 200);
  } catch (err) { 
    await session.abortTransaction();
    session.endSession();
    logger.error('Error deleting faculty', { error: err.message, empId: req.params.empId, userId: req.user.id });
    next(err); 
  }
});

// POST /api/faculty/:empId/restore  (admin)
router.post('/:empId/restore', requireAuth, requireAdmin, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const empId = String(req.params.empId || '').trim();
    const doc = await Faculty.findOneAndUpdate(
      { empId, isDeleted: true },
      { $set: { isDeleted: false, deletedAt: null } },
      { new: true, session }
    ).lean();

    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      return sendNotFound(res, 'Deleted faculty member not found.');
    }

    await Workload.updateMany({ empId, isDeleted: true }, { $set: { isDeleted: false, deletedAt: null } }, { session });
    await Submission.updateMany({ empId, isDeleted: true }, { $set: { isDeleted: false, deletedAt: null } }, { session });
    await User.updateMany({ empId, isDeleted: true }, { $set: { isDeleted: false, deletedAt: null } }, { session });

    await logAuditEvent({ req, action: 'faculty.restore', entity: 'faculty', entityId: empId });
    
    await session.commitTransaction();
    session.endSession();
    
    logger.info('Faculty restored', { empId, userId: req.user.id });
    sendSuccess(res, toClient(doc), 200, { message: 'Faculty member restored successfully.' });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Error restoring faculty', { error: err.message, empId: req.params.empId, userId: req.user.id });
    next(err);
  }
});

// POST /api/faculty/import  (admin)
router.post('/import', requireAuth, requireAdmin, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (!req.body.faculty || !Array.isArray(req.body.faculty)) {
      await session.abortTransaction();
      session.endSession();
      return sendError(res, 'Invalid data. Expected an array of faculty.', 400);
    }

    let createdCount = 0;
    for (const item of req.body.faculty) {
      const { empId, name, department = 'CSE', designation, mobile = '', email = '' } = item;
      if (!empId || !name || !designation) continue;

      const existing = await Faculty.findOne({ empId: String(empId).trim() }).session(session);
      if (existing) continue;

      const maxDoc = await Faculty.findOne().sort({ slNo: -1 }).session(session).lean();
      const slNo = await nextSequence('faculty_slno', Number(maxDoc?.slNo || 0));

      const createdDocs = await Faculty.create([{
        slNo,
        empId: String(empId).trim(),
        name: String(name).trim(),
        department: String(department || 'CSE').trim(),
        designation: String(designation).trim(),
        capacity: item.capacity !== undefined ? Number(item.capacity) : 18,
        mobile: String(mobile).trim(),
        email: String(email).trim(),
      }], { session });

      const defaultPassword = String(mobile).trim() ? String(mobile).trim() : String(empId).trim();
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      
      await User.create([{
        empId: String(empId).trim(),
        name: String(name).trim(),
        designation: String(designation).trim(),
        mobile: String(mobile).trim(),
        email: String(email).trim(),
        passwordHash,
        role: 'Faculty',
        canAccessAdmin: false,
        forcePasswordChange: true
      }], { session });
      createdCount++;
    }

    await session.commitTransaction();
    session.endSession();
    
    sendSuccess(res, { created: createdCount }, 201, { message: `Successfully imported ${createdCount} faculty members.` });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Error importing faculty', { error: err.message, userId: req.user.id });
    next(err);
  }
});

module.exports = router;

