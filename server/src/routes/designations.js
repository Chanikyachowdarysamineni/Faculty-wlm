'use strict';

const express = require('express');
const Designation = require('../models/Designation');
const Faculty = require('../models/Faculty');
const User = require('../models/User');
const Workload = require('../models/Workload');
const CourseAllocation = require('../models/CourseAllocation');
const FacultyCapacity = require('../models/FacultyCapacity');
const { mongoose } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const requireAcademicPeriod = require('../middleware/academicPeriod');
const { sendSuccess, sendError, sendValidationError, sendConflict, sendNotFound, sendCreated, sendPaginated } = require('../utils/response');
const logger = require('../utils/logger');
const { ADMIN_EMPLOYEE_IDS } = require('../config/adminConfig');
const { buildFacultyDateFilter } = require('../utils/academicPeriodUtils');
const { getDefaultCapacity, isTADesignation, invalidateDesignationCache } = require('../utils/designationUtils');

const router = express.Router();

// GET /api/designations (accessible by all authenticated users to populate dropdowns)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const docs = await Designation.find({ isEnabled: true }).sort({ order: 1 }).lean();
    if (req.query.detailed === 'true') {
      return sendSuccess(res, docs, 200);
    }
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
    const { name, order, isEnabled, category } = req.body;
    if (!name || !name.trim()) return sendError(res, 'Designation name is required.', 400);

    const trimmedName = name.trim();
    const existing = await Designation.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existing) {
      return sendConflict(res, `Designation "${trimmedName}" already exists.`);
    }

    let targetCategory = category;
    if (!targetCategory || !['FACULTY', 'TA_INSTRUCTOR'].includes(targetCategory)) {
      targetCategory = isTADesignation(trimmedName) ? 'TA_INSTRUCTOR' : 'FACULTY';
    }

    const doc = await Designation.create({
      name: trimmedName,
      category: targetCategory,
      order: order || 0,
      isEnabled: isEnabled !== false
    });
    invalidateDesignationCache();
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
    const { name, order, isEnabled, category } = req.body;
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
    if (category && ['FACULTY', 'TA_INSTRUCTOR'].includes(category)) {
      existing.category = category;
    }
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
    invalidateDesignationCache();
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
      invalidateDesignationCache();
      return sendSuccess(res, {
        message: `Designation "${desig.name}" is assigned to ${activeFacultyCount} active faculty member(s) and was disabled instead of deleted to protect data integrity.`,
        deactivated: true
      }, 200);
    }

    await Designation.findByIdAndDelete(req.params.id);
    invalidateDesignationCache();
    sendSuccess(res, { message: 'Designation deleted', deactivated: false }, 200);
  } catch (err) {
    logger.error('Error deleting designation', { error: err.message });
    next(err);
  }
});

// GET /api/designations/:id/workload-details - Dedicated designation faculty & workload details
router.get('/:id/workload-details', requireAuth, requireAdmin, requireAcademicPeriod, async (req, res, next) => {
  try {
    const desigParam = String(req.params.id || '').trim();
    if (!desigParam) return sendError(res, 'Designation ID is required.', 400);

    // 1. Resolve designation by ObjectId or fallback by name
    let designationDoc = null;
    if (mongoose.Types.ObjectId.isValid(desigParam)) {
      designationDoc = await Designation.findById(desigParam).lean();
    }
    if (!designationDoc) {
      designationDoc = await Designation.findOne({
        name: { $regex: new RegExp(`^${desigParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      }).lean();
    }
    if (!designationDoc) {
      return sendNotFound(res, `Designation not found for ID "${desigParam}"`);
    }

    const desigIdStr = String(designationDoc._id);
    const desigName = designationDoc.name;

    // 2. Resolve Academic Period
    const periodStart = req.academicPeriod?.periodStart || req.academicPeriod?.academicYear?.startDate;
    const periodEnd = req.academicPeriod?.periodEnd || req.academicPeriod?.academicYear?.endDate;
    const periodFilter = req.getPeriodFilter ? req.getPeriodFilter() : {};
    const academicYear = req.academicPeriod?.academicYear?.name || req.query.academicYear || '';
    const semester = req.academicPeriod?.academicYearSemester?.semesterType || req.query.semester || '';

    // 3. Faculty query with eligibility filters (joining/relieving date + admin exclusion)
    const hiddenIds = ADMIN_EMPLOYEE_IDS;
    const facultyMatch = {
      isDeleted: { $ne: true },
      empId: { $nin: hiddenIds },
      $or: [
        { designationId: designationDoc._id },
        { designation: desigName },
        { designation: { $regex: new RegExp(`^${desigName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
      ]
    };

    const dateClauses = buildFacultyDateFilter(periodStart, periodEnd);
    if (dateClauses.length > 0) {
      facultyMatch.$and = dateClauses;
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

    // 6. Aggregate faculty details
    let totalAssignedHours = 0;
    let totalCapacity = 0;

    const facultyDetails = facultyList.map((f, idx) => {
      const empIdStr = String(f.empId).trim();
      const wData = workloadByEmpId.get(empIdStr) || { assignedHours: 0, courseCount: 0 };
      const defaultCap = getDefaultCapacity(f.designation);
      const cap = capacityByEmpId.get(empIdStr) || Number(f.capacity || defaultCap);
      const assigned = wData.assignedHours || 0;
      const remaining = cap - assigned;

      totalAssignedHours += assigned;
      totalCapacity += cap;

      let status = 'Available';
      if (assigned > cap) {
        status = 'Overload';
      } else if (assigned === cap && cap > 0) {
        status = 'Normal';
      } else if (assigned > 0) {
        status = 'Normal';
      }

      return {
        _id: f._id,
        sNo: idx + 1,
        empId: empIdStr,
        name: f.name,
        designation: f.designation,
        designationId: desigIdStr,
        department: f.department || 'CSE',
        mobile: f.mobile || '—',
        email: f.email || '—',
        joiningDate: f.joiningDate ? new Date(f.joiningDate).toISOString().split('T')[0] : '—',
        relievingDate: f.relievingDate ? new Date(f.relievingDate).toISOString().split('T')[0] : '—',
        assignedHours: assigned,
        capacity: cap,
        remainingCapacity: remaining,
        courseCount: wData.courseCount,
        status,
        isOverloaded: assigned > cap,
      };
    });

    const remainingCapacity = totalCapacity - totalAssignedHours;

    sendSuccess(res, {
      designation: {
        id: desigIdStr,
        name: desigName,
        order: designationDoc.order ?? 0,
        isEnabled: designationDoc.isEnabled !== false
      },
      academicPeriod: {
        academicYear,
        semester,
      },
      summary: {
        totalFaculty: facultyList.length,
        totalAssignedHours,
        totalCapacity,
        remainingCapacity,
        isOverloaded: totalAssignedHours > totalCapacity,
      },
      faculty: facultyDetails
    }, 200);
  } catch (err) {
    logger.error('Error fetching designation workload details', { error: err.message });
    next(err);
  }
});

module.exports = router;
