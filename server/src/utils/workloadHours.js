/**
 * utils/workloadHours.js
 * Faculty workload hour calculation and validation
 */

'use strict';

const Workload = require('../models/Workload');
const Faculty = require('../models/Faculty');
const FacultyCapacity = require('../models/FacultyCapacity');
const { getDefaultCapacity } = require('./designationUtils');

/**
 * Calculate total teaching hours for a faculty member
 * Hours are calculated based on: Lecture (L) + Tutorial (T) + Practical (P) hours
 * @param {String} empId - Employee ID
 * @param {String} excludeWorkloadId - Optional: workload ID to exclude from calculation (for updates)
 * @param {Object} session - Optional mongoose session
 * @returns {Object} { totalHours, breakdown, workloads }
 */
const calculateFacultyWorkload = async (empId, excludeWorkloadId = null, session = null, semester = null) => {
  try {
    // C-3: Exclude cancelled/unallocated and soft-deleted workloads from capacity calculations
    const query = {
      empId: String(empId || '').trim(),
      allocationStatus: { $nin: ['CANCELLED', 'UNALLOCATED'] },
      isDeleted: { $ne: true },
    };
    if (semester) {
      query.semester = semester;
    }
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
const getFacultyWorkloadSummary = async (empId, excludeWorkloadId = null, session = null, semester = null) => {
  try {
    const query = Faculty.findOne({ empId: String(empId || '').trim() }).lean();
    if (session) query.session(session);
    
    const faculty = await query.exec();
    if (!faculty) {
      throw new Error(`Faculty not found: ${empId}`);
    }

    // Use semester-specific capacity if available, fallback to faculty.capacity
    let capacity = Number(faculty.capacity || getDefaultCapacity(faculty.designation));
    if (semester) {
      const capRecord = await FacultyCapacity.findOne({ empId: String(empId).trim(), semester }).lean();
      if (capRecord) capacity = Number(capRecord.capacity || capacity);
    }

    const workloadData = await calculateFacultyWorkload(empId, excludeWorkloadId, session, semester);

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
 * @param {String} semester - Optional: semester to filter workload calculation
 * @returns {Object} { canAssign: Boolean, reason: String, summary: Object }
 */
const canAssignWorkload = async (empId, lectureHours = 0, tutorialHours = 0, practicalHours = 0, excludeWorkloadId = null, session = null, semester = null) => {
  try {
    const summary = await getFacultyWorkloadSummary(empId, excludeWorkloadId, session, semester);
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
const getFacultyWorkloadReport = async (year = null, semester = null, periodStart = null, periodEnd = null) => {
  try {
    // H-8: Exclude soft-deleted faculty and admins from reports
    const { ADMIN_EMPLOYEE_IDS } = require('../config/adminConfig');
    const hiddenIds = ADMIN_EMPLOYEE_IDS;
    const facultyMatch = { isDeleted: { $ne: true }, empId: { $nin: hiddenIds } };
    if (periodEnd) {
      facultyMatch.$or = [
        { joiningDate: { $lte: new Date(periodEnd) } },
        { joiningDate: null },
        { joiningDate: { $exists: false } }
      ];
    }
    if (periodStart) {
      const startCond = [
        { relievingDate: { $gte: new Date(periodStart) } },
        { relievingDate: null },
        { relievingDate: { $exists: false } }
      ];
      if (facultyMatch.$or) {
        facultyMatch.$and = [ { $or: facultyMatch.$or }, { $or: startCond } ];
        delete facultyMatch.$or;
      } else {
        facultyMatch.$or = startCond;
      }
    }
    const allFaculty = await Faculty.find(facultyMatch).lean();
    
    // P-2 FIX: Offload data grouping and load calculation to MongoDB aggregation
    const workloadMatch = {
      allocationStatus: { $nin: ['CANCELLED', 'UNALLOCATED'] },
      isDeleted: { $ne: true },
    };
    if (year) {
      workloadMatch.year = String(year);
    }
    if (semester) {
      workloadMatch.semester = semester;
    }

    let capacityMap = new Map();
    if (semester) {
      const capacities = await FacultyCapacity.find({ semester }).lean();
      capacities.forEach(c => capacityMap.set(c.empId, Number(c.capacity || 18)));
    }

    const pipeline = [
      { $match: workloadMatch },
      {
        $group: {
          _id: '$empId',
          currentLoad: {
            $sum: {
              $add: [
                { $ifNull: ['$manualL', { $ifNull: ['$fixedL', 0] }] },
                { $ifNull: ['$manualT', { $ifNull: ['$fixedT', 0] }] },
                { $ifNull: ['$manualP', { $ifNull: ['$fixedP', 0] }] }
              ]
            }
          },
          assignments: {
            $push: {
              id: '$_id',
              empId: '$empId',
              subjectCode: '$subjectCode',
              subjectName: '$subjectName',
              year: '$year',
              section: '$section',
              role: '$facultyRole',
              lectureHours: { $ifNull: ['$manualL', { $ifNull: ['$fixedL', 0] }] },
              tutorialHours: { $ifNull: ['$manualT', { $ifNull: ['$fixedT', 0] }] },
              practicalHours: { $ifNull: ['$manualP', { $ifNull: ['$fixedP', 0] }] },
              totalHours: {
                $add: [
                  { $ifNull: ['$manualL', { $ifNull: ['$fixedL', 0] }] },
                  { $ifNull: ['$manualT', { $ifNull: ['$fixedT', 0] }] },
                  { $ifNull: ['$manualP', { $ifNull: ['$fixedP', 0] }] }
                ]
              }
            }
          }
        }
      }
    ];

    const aggregated = await Workload.aggregate(pipeline);
    
    const workloadMap = aggregated.reduce((acc, curr) => {
      acc[curr._id] = curr;
      return acc;
    }, {});

    const report = allFaculty.map(faculty => {
      const capacity = semester && capacityMap.has(faculty.empId) ? capacityMap.get(faculty.empId) : Number(faculty.capacity || 18);
      const data = workloadMap[faculty.empId] || { currentLoad: 0, assignments: [] };
      const currentLoad = data.currentLoad;
      const remaining = capacity - currentLoad;
      const workloadPercentage = capacity > 0 ? ((currentLoad / capacity) * 100).toFixed(2) : 0;
      
      return {
        empId: faculty.empId,
        name: faculty.name,
        designation: faculty.designation,
        department: faculty.department,
        totalCapacity: capacity,
        currentLoad: currentLoad,
        remainingHours: remaining,
        utilizationPercent: parseFloat(workloadPercentage),
        isOverAllocated: currentLoad > capacity,
        assignmentCount: data.assignments.length,
        assignments: data.assignments
      };
    });

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
