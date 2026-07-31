'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Faculty = require('../models/Faculty');
const AuditLog = require('../models/AuditLog');
const { recalculateCapacity, logCapacityChange } = require('../utils/capacityUtils');

// Helper to send errors
const sendError = (res, message, status = 400) => {
  return res.status(status).json({ success: false, message });
};

// 1. GET Faculty Capacity
router.get('/:empId/capacity', requireAuth, async (req, res, next) => {
  try {
    const faculty = await Faculty.findOne({ empId: req.params.empId }).lean();
    if (!faculty) return sendError(res, 'Faculty not found', 404);

    return res.json({
      success: true,
      data: {
        capacity: faculty.capacity || 18,
        allocated: faculty.allocated || 0,
        remaining: faculty.remaining ?? 18,
        workloadPercentage: faculty.workloadPercentage || 0,
        status: faculty.status || 'Available',
        updatedBy: faculty.updatedBy || 'System',
        updatedAt: faculty.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
});

// 2. PUT Update Capacity
router.put(
  '/:empId/capacity',
  requireAuth,
  requireAdmin,
  [
    body('capacity').isNumeric().withMessage('Must be a number').notEmpty(),
    body('reason').optional().isString()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const empId = req.params.empId;
      const { capacity, reason } = req.body;

      if (capacity < 1 || capacity > 60 || !Number.isInteger(Number(capacity))) {
         throw new Error("Capacity must be an integer between 1 and 60.");
      }

      const faculty = await Faculty.findOne({ empId }).session(session);
      if (!faculty) throw new Error('Faculty not found');

      const oldCapacity = faculty.capacity || 18;

      faculty.capacity = capacity;
      faculty.updatedBy = req.user.empId;
      await faculty.save({ session });

      // Recalculate
      const updatedFaculty = await recalculateCapacity(empId, { session, updatedBy: req.user.empId });

      await logCapacityChange({
        empId,
        adminId: req.user.empId,
        oldCapacity,
        newCapacity: capacity,
        action: 'UPDATE_CAPACITY',
        reason: reason || 'Manual Admin Update',
        ip: req.ip,
        userAgent: req.get('user-agent'),
        session
      });

      await session.commitTransaction();
      res.json({ success: true, data: updatedFaculty });
    } catch (err) {
      await session.abortTransaction();
      if (err.message === 'Faculty not found') return sendError(res, err.message, 404);
      if (err.message === 'Capacity must be an integer between 1 and 60.') return sendError(res, err.message, 400);
      next(err);
    } finally {
      session.endSession();
    }
  }
);

// 3. POST Reset Capacity
router.post('/:empId/reset-capacity', requireAuth, requireAdmin, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const empId = req.params.empId;
    const faculty = await Faculty.findOne({ empId }).session(session);
    if (!faculty) throw new Error('Faculty not found');

    const oldCapacity = faculty.capacity || 18;

    faculty.capacity = 18; // default
    faculty.updatedBy = req.user.empId;
    await faculty.save({ session });

    const updatedFaculty = await recalculateCapacity(empId, { session, updatedBy: req.user.empId });

    await logCapacityChange({
      empId,
      adminId: req.user.empId,
      oldCapacity,
      newCapacity: 18,
      action: 'RESET_CAPACITY',
      reason: 'Admin Reset',
      ip: req.ip,
      userAgent: req.get('user-agent'),
      session
    });

    await session.commitTransaction();
    res.json({ success: true, data: updatedFaculty });
  } catch (err) {
    await session.abortTransaction();
    if (err.message === 'Faculty not found') return sendError(res, err.message, 404);
    next(err);
  } finally {
    session.endSession();
  }
});

// 4. POST Bulk Upload Capacity
router.post('/bulk-capacity', requireAuth, requireAdmin, async (req, res, next) => {
  if (!Array.isArray(req.body.data)) {
    return sendError(res, 'Invalid payload, expected { data: [] }', 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let successCount = 0;
    const errors = [];

    for (const item of req.body.data) {
      const { empId, capacity } = item;
      
      if (!empId || capacity == null) {
        errors.push(`Missing data for entry: ${JSON.stringify(item)}`);
        continue;
      }
      
      const faculty = await Faculty.findOne({ empId }).session(session);
      if (!faculty) {
        errors.push(`Faculty not found: ${empId}`);
        continue;
      }

      const oldCapacity = faculty.capacity || 18;

      faculty.capacity = Number(capacity);
      faculty.updatedBy = req.user.empId;
      await faculty.save({ session });

      await recalculateCapacity(empId, { session, updatedBy: req.user.empId });

      await logCapacityChange({
        empId,
        adminId: req.user.empId,
        oldCapacity,
        newCapacity: faculty.capacity,
        action: 'BULK_UPDATE_CAPACITY',
        reason: 'Bulk Import',
        ip: req.ip,
        userAgent: req.get('user-agent'),
        session
      });
      successCount++;
    }

    await session.commitTransaction();
    res.json({ success: true, message: `Successfully updated ${successCount} faculties.`, errors });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
});

// 5. GET Capacity History
router.get('/:empId/capacity-history', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const logs = await AuditLog.find({ entity: 'faculty_capacity', entityId: req.params.empId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
