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
 * @param {Object} session - Optional mongoose session
 * @returns {Object} { totalHours, breakdown, workloads }
 */
const calculateFacultyWorkload = async (empId, excludeWorkloadId = null, session = null) => {
  try {
    const query = { empId: String(empId || '').trim() };
    const dbQuery = Workload.find(query).lean();
    if (session) dbQuery.session(session);
    const workloads = await dbQuery.exec();

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

      const L = Number(w.manualL !== undefined && w.manualL !== null ? w.manualL : (w.fixedL || 0));
      const T = Number(w.manualT !== undefined && w.manualT !== null ? w.manualT : (w.fixedT || 0));
      const P = Number(w.manualP !== undefined && w.manualP !== null ? w.manualP : (w.fixedP || 0));
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
 * @param {String} excludeWorkloadId - Optional: workload ID to exclude from calculation
 * @param {Object} session - Optional mongoose session
 * @returns {Object} { empId, name, capacity, currentLoad, remaining, workloadPercentage, assignments }
 */
const getFacultyWorkloadSummary = async (empId, excludeWorkloadId = null, session = null) => {
  try {
    const query = Faculty.findOne({ empId: String(empId || '').trim() }).lean();
    if (session) query.session(session);
    
    const faculty = await query.exec();
    if (!faculty) {
      throw new Error(`Faculty not found: ${empId}`);
    }

    const capacity = Number(faculty.capacity || 18);
    const workloadData = await calculateFacultyWorkload(empId, excludeWorkloadId, session);

    const currentLoad = workloadData.totalHours;
    const remaining = capacity - currentLoad;
    const workloadPercentage = capacity > 0 ? ((currentLoad / capacity) * 100).toFixed(2) : 0;

    return {
      empId: faculty.empId,
      name: faculty.name,
      designation: faculty.designation,
      capacity,
      currentLoad,
      remaining,
      workloadPercentage: parseFloat(workloadPercentage),
      isOverAllocated: currentLoad > capacity,
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
 * @param {Object} session - Optional mongoose session
 * @returns {Object} { canAssign: Boolean, reason: String, summary: Object }
 */
const canAssignWorkload = async (empId, lectureHours = 0, tutorialHours = 0, practicalHours = 0, excludeWorkloadId = null, session = null) => {
  try {
    const summary = await getFacultyWorkloadSummary(empId, excludeWorkloadId, session);
    const additionalHours = Number(lectureHours || 0) + Number(tutorialHours || 0) + Number(practicalHours || 0);
    const newTotal = summary.currentLoad + additionalHours;
    const capacity = summary.capacity;

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
        remainingAfterAssignment: capacity - newTotal
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
    const allWorkloads = await Workload.find({}).lean();
    
    // Group workloads by empId
    const workloadsByEmp = {};
    for (const w of allWorkloads) {
      if (!workloadsByEmp[w.empId]) workloadsByEmp[w.empId] = [];
      workloadsByEmp[w.empId].push(w);
    }

    const report = [];

    for (const faculty of allFaculty) {
      const capacity = Number(faculty.capacity || 18);
      const facultyWorkloads = workloadsByEmp[faculty.empId] || [];
      
      let currentLoad = 0;
      const assignments = [];
      
      for (const w of facultyWorkloads) {
        const L = Number(w.manualL !== undefined && w.manualL !== null ? w.manualL : (w.fixedL || 0));
        const T = Number(w.manualT !== undefined && w.manualT !== null ? w.manualT : (w.fixedT || 0));
        const P = Number(w.manualP !== undefined && w.manualP !== null ? w.manualP : (w.fixedP || 0));
        const hoursForThisAssignment = L + T + P;
        
        currentLoad += hoursForThisAssignment;
        
        assignments.push({
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
      }
      
      const filteredAssignments = year ? assignments.filter(a => a.year === String(year)) : assignments;
      const remaining = capacity - currentLoad;
      const workloadPercentage = capacity > 0 ? ((currentLoad / capacity) * 100).toFixed(2) : 0;

      report.push({
        empId: faculty.empId,
        name: faculty.name,
        designation: faculty.designation,
        department: faculty.department,
        totalCapacity: capacity,
        currentLoad: currentLoad,
        remainingHours: remaining,
        utilizationPercent: parseFloat(workloadPercentage),
        isOverAllocated: currentLoad > capacity,
        assignmentCount: filteredAssignments.length,
        assignments: filteredAssignments
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
