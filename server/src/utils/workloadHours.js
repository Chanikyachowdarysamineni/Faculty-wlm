/**
 * utils/workloadHours.js
 * Faculty workload hour calculation and validation
 */

'use strict';

const Workload = require('../models/Workload');
const Faculty = require('../models/Faculty');

/**
 * Calculate total teaching hours for a faculty member
 * Hours are calculated based on: Lecture (L) + Tutorial (T) + Practical (P) hours
 * @param {String} empId - Employee ID
 * @param {String} excludeWorkloadId - Optional: workload ID to exclude from calculation (for updates)
 * @returns {Object} { totalHours, breakdown, workloads }
 */
const calculateFacultyWorkload = async (empId, excludeWorkloadId = null) => {
  try {
    const query = { empId: String(empId || '').trim() };
    const workloads = await Workload.find(query).lean();

    let totalHours = 0;
    const breakdown = {
      lectureHours: 0,
      tutorialHours: 0,
      practicalHours: 0,
      assignments: []
    };

    workloads.forEach(w => {
      // Skip excluded workload (used during update)
      if (excludeWorkloadId && String(w._id) === String(excludeWorkloadId)) {
        return;
      }

      const L = Number(w.manualL || w.fixedL || 0);
      const T = Number(w.manualT || w.fixedT || 0);
      const P = Number(w.manualP || w.fixedP || 0);
      const hoursForThisAssignment = L + T + P;

      totalHours += hoursForThisAssignment;
      breakdown.lectureHours += L;
      breakdown.tutorialHours += T;
      breakdown.practicalHours += P;

      breakdown.assignments.push({
        id: String(w._id),
        empId: w.empId,
        subjectCode: w.subjectCode,
        subjectName: w.subjectName,
        year: w.year,
        section: w.section,
        role: w.facultyRole,
        lectureHours: L,
        tutorialHours: T,
        practicalHours: P,
        totalHours: hoursForThisAssignment
      });
    });

    return {
      empId,
      totalHours,
      breakdown,
      assignmentCount: workloads.length,
      workloads
    };
  } catch (err) {
    console.error('[workloadHours] Error calculating faculty workload:', err.message);
    throw err;
  }
};

/**
 * Get faculty workload summary with remaining hours
 * @param {String} empId - Employee ID
 * @returns {Object} { empId, name, totalWorkingHours, currentLoad, remainingHours, utilizationPercent, assignments }
 */
const getFacultyWorkloadSummary = async (empId) => {
  try {
    const faculty = await Faculty.findOne({ empId: String(empId || '').trim() }).lean();
    if (!faculty) {
      throw new Error(`Faculty not found: ${empId}`);
    }

    const totalWorkingHours = Number(faculty.totalWorkingHours || 24);
    const workloadData = await calculateFacultyWorkload(empId);

    const currentLoad = workloadData.totalHours;
    const remainingHours = Math.max(0, totalWorkingHours - currentLoad);
    const utilizationPercent = totalWorkingHours > 0 ? ((currentLoad / totalWorkingHours) * 100).toFixed(2) : 0;

    return {
      empId: faculty.empId,
      name: faculty.name,
      designation: faculty.designation,
      totalWorkingHours,
      currentLoad,
      remainingHours,
      utilizationPercent: parseFloat(utilizationPercent),
      isOverAllocated: currentLoad > totalWorkingHours,
      breakdown: workloadData.breakdown,
      assignmentCount: workloadData.assignmentCount,
      assignments: workloadData.breakdown.assignments
    };
  } catch (err) {
    console.error('[workloadHours] Error getting faculty summary:', err.message);
    throw err;
  }
};

/**
 * Check if adding new workload would exceed faculty capacity
 * @param {String} empId - Employee ID
 * @param {Number} lectureHours - Lecture hours to add
 * @param {Number} tutorialHours - Tutorial hours to add
 * @param {Number} practicalHours - Practical hours to add
 * @param {String} excludeWorkloadId - Optional: workload ID to exclude (for updates)
 * @returns {Object} { canAssign: Boolean, reason: String, summary: Object }
 */
const canAssignWorkload = async (empId, lectureHours = 0, tutorialHours = 0, practicalHours = 0, excludeWorkloadId = null) => {
  try {
    const summary = await getFacultyWorkloadSummary(empId);
    const additionalHours = Number(lectureHours || 0) + Number(tutorialHours || 0) + Number(practicalHours || 0);
    const newTotal = summary.currentLoad + additionalHours;
    const capacity = summary.totalWorkingHours;

    const canAssign = newTotal <= capacity;
    let reason = '';

    if (!canAssign) {
      const exceededBy = newTotal - capacity;
      reason = `Cannot assign ${additionalHours}h. Faculty would exceed capacity by ${exceededBy}h (current: ${summary.currentLoad}h/${capacity}h)`;
    }

    return {
      canAssign,
      reason,
      summary: {
        currentLoad: summary.currentLoad,
        additionalHours,
        newTotal,
        capacity,
        remainingAfterAssignment: Math.max(0, capacity - newTotal)
      }
    };
  } catch (err) {
    console.error('[workloadHours] Error checking assignment capacity:', err.message);
    throw err;
  }
};

/**
 * Get list of faculty by workload utilization (for report/analytics)
 * @param {String} year - Optional filter by year
 * @returns {Array} Array of faculty with their workload status
 */
const getFacultyWorkloadReport = async (year = null) => {
  try {
    const allFaculty = await Faculty.find({}).lean();
    const report = [];

    for (const faculty of allFaculty) {
      const summary = await getFacultyWorkloadSummary(faculty.empId);
      
      let assignments = summary.assignments;
      if (year) {
        assignments = assignments.filter(a => a.year === String(year));
      }

      report.push({
        empId: faculty.empId,
        name: faculty.name,
        designation: faculty.designation,
        department: faculty.department,
        totalCapacity: summary.totalWorkingHours,
        currentLoad: summary.currentLoad,
        remainingHours: summary.remainingHours,
        utilizationPercent: summary.utilizationPercent,
        isOverAllocated: summary.isOverAllocated,
        assignmentCount: assignments.length,
        assignments: year ? assignments : summary.assignments
      });
    }

    return report.sort((a, b) => b.utilizationPercent - a.utilizationPercent);
  } catch (err) {
    console.error('[workloadHours] Error generating workload report:', err.message);
    throw err;
  }
};

module.exports = {
  calculateFacultyWorkload,
  getFacultyWorkloadSummary,
  canAssignWorkload,
  getFacultyWorkloadReport
};
