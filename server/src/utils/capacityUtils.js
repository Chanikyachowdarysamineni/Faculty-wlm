'use strict';

const mongoose = require('mongoose');
const Faculty = require('../models/Faculty');
const Workload = require('../models/Workload');
const AuditLog = require('../models/AuditLog');
const wsHandler = require('../websocket'); // Adjust path if needed

/**
 * Recalculate status based on remaining hours and utilization percentage
 * @param {Number} remaining - remaining hours
 * @param {Number} utilization - utilization percentage 
 * @returns {String} status - 'Available', 'Nearly Full', 'Full', 'Overloaded'
 */
const getStatus = (remaining, utilization) => {
  if (remaining < 0) return 'Overloaded';
  if (remaining === 0) return 'Full';
  if (utilization >= 80) return 'Nearly Full';
  return 'Available';
};

/**
 * Calculates and updates faculty capacity.
 * Runs atomically inside a transaction.
 * @param {String} empId - The employee ID
 * @param {Object} options - { session, updatedBy }
 */
const recalculateCapacity = async (empId, options = {}) => {
  const session = options.session;
  if (!empId) return;

  const faculty = await Faculty.findOne({ empId }).session(session);
  if (!faculty) return null;

  // C-4: Aggregate total allocated hours — exclude cancelled/unallocated/deleted workloads
  const workloads = await Workload.find({
    empId,
    allocationStatus: { $nin: ['CANCELLED', 'UNALLOCATED'] },
    isDeleted: { $ne: true },
  }).session(session).lean();
  let lectureHours = 0;
  let tutorialHours = 0;
  let practicalHours = 0;
  let allocated = 0;

  for (const w of workloads) {
    lectureHours += Number(w.manualL !== undefined && w.manualL !== null ? w.manualL : (w.fixedL || 0));
    tutorialHours += Number(w.manualT !== undefined && w.manualT !== null ? w.manualT : (w.fixedT || 0));
    practicalHours += Number(w.manualP !== undefined && w.manualP !== null ? w.manualP : (w.fixedP || 0));
  }
  allocated = lectureHours + tutorialHours + practicalHours;

  // Strict check: default to 18 only if completely missing. Allow 0.
  const capacity = (faculty.capacity !== undefined && faculty.capacity !== null) ? Number(faculty.capacity) : 18;
  let remaining = capacity - allocated;
  // Rule 7: Do NOT allow negative remaining hours to be set to 0. Keep it negative to indicate overload.

  let workloadPercentage = 0;
  if (capacity > 0) {
    workloadPercentage = (allocated / capacity) * 100;
  }
  
  workloadPercentage = Math.round(workloadPercentage * 100) / 100; // Round to 2 decimals
  const status = getStatus(remaining, workloadPercentage);

  faculty.allocated = allocated;
  faculty.remaining = remaining;
  faculty.workloadPercentage = workloadPercentage;
  faculty.status = status;
  faculty.updatedBy = options.updatedBy || 'System';

  await faculty.save({ session });

  // M-5: Only broadcast a safe summary — never send full faculty document
  if (wsHandler) {
    wsHandler.broadcast({
      type: 'CAPACITY_UPDATE',
      data: {
        empId: faculty.empId,
        allocated: faculty.allocated,
        remaining: faculty.remaining,
        workloadPercentage: faculty.workloadPercentage,
        status: faculty.status,
        capacity: faculty.capacity,
      },
    });
  }

  return faculty;
};

/**
 * Logs a capacity change to AuditLog
 * @param {Object} params - { empId, adminId, oldCapacity, newCapacity, action, reason, ip, userAgent, session }
 */
const logCapacityChange = async ({ empId, adminId, oldCapacity, newCapacity, action, reason, ip, userAgent, session }) => {
  const log = new AuditLog({
    actorEmpId: adminId,
    actorRole: 'admin',
    action: action,
    entity: 'faculty_capacity',
    entityId: empId,
    metadata: {
      oldCapacity,
      newCapacity,
      reason
    },
    ip,
    userAgent
  });
  await log.save({ session });
};

module.exports = {
  getStatus,
  recalculateCapacity,
  logCapacityChange
};
