'use strict';

const mongoose = require('mongoose');
const Faculty = require('../models/Faculty');
const Workload = require('../models/Workload');
const AuditLog = require('../models/AuditLog');
const wsHandler = require('../websocket'); // Adjust path if needed

/**
 * Recalculate status based on utilization percentage
 * @param {Number} utilization - utilization percentage 
 * @returns {String} status - 'Green', 'Yellow', 'Red', 'Overloaded'
 */
const getStatus = (utilization) => {
  if (utilization < 80) return 'Available';
  if (utilization < 100) return 'Nearly Full';
  if (utilization === 100) return 'Full';
  return 'Overloaded';
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

  // Aggregate total allocated hours
  const workloads = await Workload.find({ empId }).session(session).lean();
  let lectureHours = 0;
  let tutorialHours = 0;
  let practicalHours = 0;
  let allocated = 0;

  for (const w of workloads) {
    lectureHours += Number(w.manualL) || 0;
    tutorialHours += Number(w.manualT) || 0;
    practicalHours += Number(w.manualP) || 0;
  }
  allocated = lectureHours + tutorialHours + practicalHours;

  const weeklyCapacity = faculty.weeklyCapacityHours || 30;
  let remaining = weeklyCapacity - allocated;
  if (remaining < 0) remaining = 0; // Never allow negative remaining hours

  let utilization = 0;
  if (weeklyCapacity > 0) {
    utilization = (allocated / weeklyCapacity) * 100;
  }
  
  utilization = Math.round(utilization * 100) / 100; // Round to 2 decimals
  const status = getStatus(utilization);

  faculty.lectureHours = lectureHours;
  faculty.tutorialHours = tutorialHours;
  faculty.practicalHours = practicalHours;
  faculty.allocatedHours = allocated;
  faculty.remainingHours = remaining;
  faculty.utilizationPercentage = utilization;
  faculty.status = status;
  faculty.updatedBy = options.updatedBy || 'System';

  await faculty.save({ session });

  // Broadcast real-time update
  if (wsHandler) {
    wsHandler.broadcast({
      type: 'CAPACITY_UPDATE',
      data: faculty
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
