'use strict';

const express = require('express');
const Designation = require('../models/Designation');
const Faculty = require('../models/Faculty');
const User = require('../models/User');
const Workload = require('../models/Workload');
const CourseAllocation = require('../models/CourseAllocation');
const { mongoose } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendSuccess, sendError, sendValidationError, sendConflict, sendNotFound, sendCreated, sendPaginated } = require('../utils/response');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/designations (accessible by all authenticated users to populate dropdowns)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const docs = await Designation.find({ isEnabled: true }).sort({ order: 1 }).lean();
    sendSuccess(res, docs.map(d => d.name), 200);
  } catch (err) {
    logger.error('Error listing designations', { error: err.message });
    next(err);
  }
});

// GET /api/designations/admin (Admin only - raw objects)
router.get('/admin', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const docs = await Designation.find().sort({ order: 1 }).lean();
    sendSuccess(res, docs, 200);
  } catch (err) {
    logger.error('Error listing admin designations', { error: err.message });
    next(err);
  }
});

// POST /api/designations (Admin only)
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, order, isEnabled } = req.body;
    if (!name || !name.trim()) return sendError(res, 'Designation name is required.', 400);

    const trimmedName = name.trim();
    const existing = await Designation.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existing) {
      return sendConflict(res, `Designation "${trimmedName}" already exists.`);
    }

    const doc = await Designation.create({ name: trimmedName, order: order || 0, isEnabled: isEnabled !== false });
    sendSuccess(res, doc, 201);
  } catch (err) {
    if (err.code === 11000) {
      return sendConflict(res, 'Designation already exists.');
    }
    logger.error('Error creating designation', { error: err.message });
    next(err);
  }
});

// PUT /api/designations/:id (Admin only)
router.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { name, order, isEnabled } = req.body;
    const newName = name?.trim();
    
    const existing = await Designation.findById(req.params.id).session(session);
    if (!existing) {
      await session.abortTransaction();
      session.endSession();
      return sendNotFound(res, 'Designation not found');
    }
    
    const oldName = existing.name;
    const isNameChanged = newName && oldName !== newName;

    if (isNameChanged) {
      const duplicate = await Designation.findOne({
        _id: { $ne: req.params.id },
        name: { $regex: new RegExp(`^${newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      }).session(session);
      if (duplicate) {
        await session.abortTransaction();
        session.endSession();
        return sendConflict(res, `Designation "${newName}" already exists.`);
      }
    }

    existing.name = newName || existing.name;
    if (order !== undefined) existing.order = order;
    if (isEnabled !== undefined) existing.isEnabled = isEnabled;
    await existing.save({ session });
    
    if (isNameChanged) {
      // Cascade rename to Faculty, User, Workload, CourseAllocation, submissions
      await Faculty.updateMany({ designation: oldName }, { $set: { designation: newName } }, { session });
      await User.updateMany({ designation: oldName }, { $set: { designation: newName } }, { session });
      await Workload.updateMany({ designation: oldName }, { $set: { designation: newName } }, { session });
      
      const allocs = await CourseAllocation.find({
        $or: [
          { "lectureSlots.designation": oldName },
          { "lectureSlot.designation": oldName },
          { "tutorialSlots.designation": oldName },
          { "practicalSlots.designation": oldName }
        ]
      }).session(session);

      for (const alloc of allocs) {
        const updSlot = (s) => { if (s && s.designation === oldName) s.designation = newName; };
        if (alloc.lectureSlots) alloc.lectureSlots.forEach(updSlot);
        if (alloc.lectureSlot) updSlot(alloc.lectureSlot);
        if (alloc.tutorialSlots) alloc.tutorialSlots.forEach(updSlot);
        if (alloc.practicalSlots) alloc.practicalSlots.forEach(updSlot);
        
        alloc.markModified('lectureSlots');
        alloc.markModified('lectureSlot');
        alloc.markModified('tutorialSlots');
        alloc.markModified('practicalSlots');
        await alloc.save({ session });
      }
      
      await mongoose.connection.db.collection('submissions').updateMany(
        { designation: oldName },
        { $set: { designation: newName } },
        { session }
      );
      
      logger.info(`Cascaded designation rename from ${oldName} to ${newName}`);
    }
    
    await session.commitTransaction();
    session.endSession();
    sendSuccess(res, existing, 200);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    if (err.code === 11000) {
      return sendConflict(res, 'Designation already exists.');
    }
    logger.error('Error updating designation', { error: err.message });
    next(err);
  }
});

// DELETE /api/designations/:id (Admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const desig = await Designation.findById(req.params.id);
    if (!desig) return sendNotFound(res, 'Designation not found');

    // Check if any active faculty use this designation
    const activeFacultyCount = await Faculty.countDocuments({
      designation: desig.name,
      isDeleted: { $ne: true }
    });
    if (activeFacultyCount > 0) {
      desig.isEnabled = false;
      await desig.save();
      return sendSuccess(res, {
        message: `Designation "${desig.name}" is assigned to ${activeFacultyCount} active faculty member(s) and was disabled instead of deleted to protect data integrity.`,
        deactivated: true
      }, 200);
    }

    await Designation.findByIdAndDelete(req.params.id);
    sendSuccess(res, { message: 'Designation deleted', deactivated: false }, 200);
  } catch (err) {
    logger.error('Error deleting designation', { error: err.message });
    next(err);
  }
});

module.exports = router;
