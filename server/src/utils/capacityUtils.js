'use strict';

const mongoose = require('mongoose');
const Faculty = require('../models/Faculty');
const FacultyCapacity = require('../models/FacultyCapacity');
const Workload = require('../models/Workload');
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

  // We will recalculate for both semesters, or a specific one if provided
  const semestersToProcess = options.semester ? [options.semester] : ['ODD', 'EVEN'];
  const results = [];

  for (const currentSemester of semestersToProcess) {


    // Ensure we have academicYear
    const currentAcademicYear = options.academicYear || '2026-2027';

    // C-4: Aggregate total allocated hours — exclude cancelled/unallocated/deleted workloads
    const workloads = await Workload.find({
      empId,
      semester: currentSemester,
      academicYear: currentAcademicYear,
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

    // Get or create FacultyCapacity record
    let capRecord = await FacultyCapacity.findOne({ empId, semester: currentSemester, academicYear: currentAcademicYear }).session(session);
    if (!capRecord) {
      capRecord = new FacultyCapacity({
        empId,
        semester: currentSemester,
        academicYear: currentAcademicYear,
        capacity: (faculty.capacity !== undefined && faculty.capacity !== null) ? Number(faculty.capacity) : require('./designationUtils').getDefaultCapacity(faculty.designation),
      });
    }

    const capacity = capRecord.capacity;
    let remaining = capacity - allocated;

    let workloadPercentage = 0;
    if (capacity > 0) {
      workloadPercentage = (allocated / capacity) * 100;
    }
    
    workloadPercentage = Math.round(workloadPercentage * 100) / 100;
    const status = getStatus(remaining, workloadPercentage);

    capRecord.allocated = allocated;
    capRecord.remaining = remaining;
    capRecord.workloadPercentage = workloadPercentage;
    capRecord.status = status;
    capRecord.updatedBy = options.updatedBy || 'System';

    await capRecord.save({ session });
    results.push(capRecord);

    if (wsHandler) {
      wsHandler.broadcast({
        type: 'CAPACITY_UPDATE',
        data: {
          empId,
          semester: currentSemester,
          allocated,
          remaining,
          workloadPercentage,
          status,
          capacity,
        },
      });
    }
  }

  return results.length === 1 ? results[0] : results;
};


module.exports = {
  getStatus,
  recalculateCapacity
};
