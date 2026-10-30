/**
 * routes/stats.js
 *
 * GET /api/stats — dashboard overview (auth)
 */

'use strict';

const express     = require('express');
const Faculty     = require('../models/Faculty');
const Course      = require('../models/Course');
const Submission  = require('../models/Submission');
const Workload    = require('../models/Workload');
const CourseAllocation = require('../models/CourseAllocation');
const Setting     = require('../models/Setting');
const { sendSuccess, sendError, sendValidationError, sendConflict, sendNotFound, sendCreated, sendPaginated } = require('../utils/response');
const { requireAuth, requireAdmin, requireSelfOrAdmin } = require('../middleware/auth');
const requireAcademicPeriod = require('../middleware/academicPeriod');
const { getFacultyWorkloadSummary, getFacultyWorkloadReport } = require('../utils/workloadHours');
const { ADMIN_EMPLOYEE_IDS } = require('../config/adminConfig');
const { TA_DESIGNATIONS, matchTaDesignation, getDefaultCapacity } = require('../utils/designationUtils');
const { buildFacultyDateFilter } = require('../utils/academicPeriodUtils');

const router = express.Router();

const sec = (n) => Array.from({ length: n }, (_, i) => String(i + 1));
const DEFAULT_SECTIONS = {
  I: sec(19), II: sec(22), III: sec(19), IV: [...sec(19), ...Array.from({ length: 9 }, (_, i) => String(51 + i))],
  'M.Tech_I': ['1'],
  'M.Tech_II': ['1']
};

const getSectionsConfig = async (academicYear, semester) => {
  let doc = null;
  const sem = String(semester || '').toUpperCase().trim();
  const yr = String(academicYear || '').trim();

  if (yr && sem) {
    doc = await Setting.findOne({ key: `sections_config_${yr}_${sem}` }).lean();
  }
  // Strict period isolation: never cross-pollinate between ODD and EVEN semesters
  if (!doc && yr) {
    doc = await Setting.findOne({ key: `sections_config_${yr}` }).lean();
  }
  if (!doc) {
    doc = await Setting.findOne({ key: 'sections_config' }).lean();
  }
  if (!doc?.value) return DEFAULT_SECTIONS;
  try {
    const parsed = JSON.parse(doc.value);
    return { ...DEFAULT_SECTIONS, ...(parsed || {}) };
  } catch {
    return DEFAULT_SECTIONS;
  }
};

router.post('/auto-repair', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const User = require('../models/User');
    
    // 1. Delete Orphaned Workloads (empId not in Faculty)
    const orphanedWorkloads = await Workload.aggregate([
      {
        $lookup: {
          from: 'faculty',
          localField: 'empId',
          foreignField: 'empId',
          as: 'facultyData'
        }
      },
      { $match: { facultyData: { $size: 0 } } },
      { $project: { _id: 1 } }
    ]);
    
    const orphanedWorkloadIds = orphanedWorkloads.map(w => w._id);
      
    let deletedWorkloads = 0;
    if (orphanedWorkloadIds.length > 0) {
      const result = await Workload.deleteMany({ _id: { $in: orphanedWorkloadIds } });
      deletedWorkloads = result.deletedCount;
    }

    // 2. Ensure all Faculty have a User account (only non-deleted faculty)
    const missingUsers = await Faculty.aggregate([
      {
        $match: { isDeleted: { $ne: true } }   // H-3 FIX: skip soft-deleted faculty
      },
      {
        $lookup: {
          from: 'users',
          localField: 'empId',
          foreignField: 'empId',
          as: 'userData'
        }
      },
      { $match: { userData: { $size: 0 } } }
    ]);
    
    let createdUsers = 0;
    const bcrypt = require('bcryptjs');
    
    for (const f of missingUsers) {
      const empId = String(f.empId).trim();
      const defaultPassword = String(f.mobile || f.empId).trim();
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      
      await User.create({
        empId,
        name: f.name || 'Unknown',
        designation: f.designation || 'Faculty',
        mobile: f.mobile || '',
        email: f.email || '',
        passwordHash,
        role: 'faculty',  // M-6: Lowercase 'faculty' for consistency
        canAccessAdmin: false,
        forcePasswordChange: true
      });
      createdUsers++;
    }

    res.json({
      success: true,
      message: 'Database auto-repair completed successfully.',
      data: {
        deletedOrphanedWorkloads: deletedWorkloads,
        createdMissingUsers: createdUsers
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/integrity', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const [
      facultyRows,
      courseRows,
      workloadRows,
      allocationRows,
      submissionRows,
      duplicateWorkloads,
      duplicateAllocations,
      duplicateFaculty,
      duplicateCourses,
      nullCriticalCounts,
    ] = await Promise.all([
      Faculty.find().select({ empId: 1 }).lean(),
      Course.find().select({ courseId: 1 }).lean(),
      Workload.find().select({ _id: 1, empId: 1, courseId: 1, year: 1, section: 1, subjectCode: 1, subjectName: 1 }).lean(),
      CourseAllocation.find().select({ _id: 1, courseId: 1, year: 1, section: 1, lectureSlot: 1, lectureSlots: 1, tutorialSlots: 1, practicalSlots: 1 }).lean(),
      Submission.find().select({ _id: 1, empId: 1, prefs: 1 }).lean(),
      Workload.aggregate([
        { $group: { _id: { courseId: '$courseId', year: '$year', section: '$section' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ]),
      CourseAllocation.aggregate([
        { $group: { _id: { courseId: '$courseId', year: '$year', section: '$section' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ]),
      Faculty.aggregate([
        { $group: { _id: '$empId', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ]),
      Course.aggregate([
        { $group: { _id: { subjectCode: '$subjectCode', courseType: '$courseType' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
      ]),
      Promise.all([
        Faculty.countDocuments({ $or: [{ empId: null }, { empId: '' }, { name: null }, { name: '' }] }),
        Course.countDocuments({ $or: [{ courseId: null }, { subjectCode: null }, { subjectCode: '' }, { subjectName: null }, { subjectName: '' }] }),
        Workload.countDocuments({ $or: [{ empId: null }, { empId: '' }, { subjectCode: null }, { subjectCode: '' }, { year: null }, { year: '' }, { section: null }, { section: '' }] }),
        Submission.countDocuments({ $or: [{ empId: null }, { empId: '' }] }),
      ]),
    ]);

    const facultySet = new Set(facultyRows.map((row) => row.empId));
    const courseSet = new Set(courseRows.map((row) => Number(row.courseId)));

    const orphanWorkloads = workloadRows.filter((row) => !facultySet.has(row.empId) || !courseSet.has(Number(row.courseId)));

    const orphanAllocationCourses = allocationRows.filter((row) => !courseSet.has(Number(row.courseId)));
    const orphanAllocationFaculty = [];
    allocationRows.forEach((row) => {
      const slots = [
        ...(row.lectureSlot?.empId ? [row.lectureSlot] : []),
        ...(Array.isArray(row.lectureSlots) ? row.lectureSlots : []),
        ...(Array.isArray(row.tutorialSlots) ? row.tutorialSlots : []),
        ...(Array.isArray(row.practicalSlots) ? row.practicalSlots : []),
      ].filter((slot) => slot?.empId);

      const bad = slots.filter((slot) => !facultySet.has(String(slot.empId)));
      if (bad.length) {
        orphanAllocationFaculty.push({
          allocationId: String(row._id),
          courseId: row.courseId,
          year: row.year,
          section: row.section,
          missingEmpIds: Array.from(new Set(bad.map((slot) => String(slot.empId)))),
        });
      }
    });

    const orphanSubmissionRows = [];
    submissionRows.forEach((row) => {
      const missingPrefs = (row.prefs || []).filter((prefId) => !courseSet.has(Number(prefId)));
      const hasFaculty = facultySet.has(row.empId);
      if (!hasFaculty || missingPrefs.length) {
        orphanSubmissionRows.push({
          submissionId: String(row._id),
          empId: row.empId,
          facultyExists: hasFaculty,
          missingPrefs,
        });
      }
    });

    const [nullFaculty, nullCourses, nullWorkloads, nullSubmissions] = nullCriticalCounts;

    res.json({
      success: true,
      data: {
        summary: {
          orphanWorkloads: orphanWorkloads.length,
          orphanAllocationCourses: orphanAllocationCourses.length,
          orphanAllocationFaculty: orphanAllocationFaculty.length,
          orphanSubmissions: orphanSubmissionRows.length,
          duplicateWorkloadKeys: duplicateWorkloads.length,
          duplicateAllocationKeys: duplicateAllocations.length,
          duplicateFacultyEmpId: duplicateFaculty.length,
          duplicateCourseSubjectCode: duplicateCourses.length,
          nullCriticalRecords: nullFaculty + nullCourses + nullWorkloads + nullSubmissions,
        },
        duplicates: {
          workloads: duplicateWorkloads,
          allocations: duplicateAllocations,
          faculty: duplicateFaculty,
          courses: duplicateCourses,
        },
        orphans: {
          workloads: orphanWorkloads,
          allocationCourses: orphanAllocationCourses.map((row) => ({
            allocationId: String(row._id),
            courseId: row.courseId,
            year: row.year,
            section: row.section,
          })),
          allocationFaculty: orphanAllocationFaculty,
          submissions: orphanSubmissionRows,
        },
        nullCritical: {
          faculty: nullFaculty,
          courses: nullCourses,
          workloads: nullWorkloads,
          submissions: nullSubmissions,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', requireAuth, requireAcademicPeriod, async (req, res, next) => {
  try {
    const periodStart = req.academicPeriod?.periodStart || req.academicPeriod?.academicYear?.startDate;
    const periodEnd = req.academicPeriod?.periodEnd || req.academicPeriod?.academicYear?.endDate;
    const hiddenIds = ADMIN_EMPLOYEE_IDS;
    const facultyMatch = { isDeleted: { $ne: true }, empId: { $nin: hiddenIds } };
    const dateClauses = buildFacultyDateFilter(periodStart, periodEnd);
    if (dateClauses.length > 0) {
      facultyMatch.$and = dateClauses;
    }

    const baseCourseFilter = { isDeleted: { $ne: true }, ...req.getPeriodFilter() };
    const baseSubmissionFilter = { isDeleted: { $ne: true }, ...req.getPeriodFilter() };
    const baseWorkloadFilter = { isDeleted: { $ne: true }, ...req.getPeriodFilter() };

    const [
      totalFaculty,
      totalCourses,
      totalSubmissions,
      totalWorkloads,
      creditAgg,
      facultyByDesignation,
      coursesByProgram,
      coursesByType,
      workloadByFaculty,
    ] = await Promise.all([
      Faculty.countDocuments(facultyMatch),
      Course.countDocuments(baseCourseFilter),
      Submission.countDocuments(baseSubmissionFilter),
      Workload.countDocuments(baseWorkloadFilter),
      Course.aggregate([{ $match: baseCourseFilter }, { $group: { _id: null, total: { $sum: '$C' } } }]),
      Faculty.aggregate([{ $match: facultyMatch }, { $group: { _id: '$designation', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Course.aggregate([{ $match: baseCourseFilter }, { $group: { _id: '$program', count: { $sum: 1 } } }]),
      Course.aggregate([{ $match: baseCourseFilter }, { $group: { _id: '$courseType', count: { $sum: 1 } } }]),
      Workload.aggregate([
        { $match: baseWorkloadFilter },
        {
          $group: {
            _id: '$empId',
            empName:          { $first: '$empName' },
            designation:      { $first: '$designation' },
            coursesAssigned:  { $sum: 1 },
            totalCredits:     { $sum: '$C' },
            // H-1: Use $ifNull to avoid null sums when fields are missing; ensure TA lecture hours are strictly 0
            totalHours: {
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
                  { $ifNull: ['$manualP', { $ifNull: ['$fixedP', 0] }] },
                ]
              }
            },
          },
        },
        { $sort: { totalHours: -1 } },
        { $limit: 20 },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        counts: {
          faculty:     totalFaculty,
          courses:     totalCourses,
          credits:     creditAgg[0]?.total || 0,
          workloads:   totalWorkloads,
          submissions: totalSubmissions,
        },
        facultyByDesignation: facultyByDesignation.map(r => ({ designation: r._id, count: r.count })),
        coursesByProgram:     coursesByProgram.map(r => ({ program: r._id, count: r.count })),
        coursesByType:        coursesByType.map(r => ({ courseType: r._id, count: r.count })),
        workloadByFaculty:    workloadByFaculty.map(r => ({
          empId:           r._id,
          empName:         r.empName,
          designation:     r.designation,
          coursesAssigned: r.coursesAssigned,
          totalCredits:    r.totalCredits,
          totalHours:      r.totalHours,
        })),
      },
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/stats/dashboard-analytics
 * Computes workload analytics across all faculty matching year and section filters
 * Admin only
 */
router.get('/dashboard-analytics', requireAuth, requireAdmin, requireAcademicPeriod, async (req, res, next) => {
  try {
    const { year, section } = req.query;

    // Build match stage — scope by semester if resolved, else return all for the year
    const semesterId = req.getSemesterId();
    const matchStage = {
      isDeleted: { $ne: true },
      allocationStatus: { $nin: ['CANCELLED', 'UNALLOCATED'] },
      ...req.getPeriodFilter()
    };

    if (year && year !== 'All') matchStage.year = String(year);
    if (section && section !== 'All') matchStage.section = String(section);

    const FacultyCapacity = require('../models/FacultyCapacity');
    const capacityFilter = semesterId ? req.getPeriodFilter() : {};

    const periodStart = req.academicPeriod?.periodStart || req.academicPeriod?.academicYear?.startDate;
    const periodEnd = req.academicPeriod?.periodEnd || req.academicPeriod?.academicYear?.endDate;
    const hiddenIds = ADMIN_EMPLOYEE_IDS;
    const facultyMatch = { isDeleted: { $ne: true }, empId: { $nin: hiddenIds } };
    const dateClauses = buildFacultyDateFilter(periodStart, periodEnd);
    if (dateClauses.length > 0) {
      facultyMatch.$and = dateClauses;
    }

    const [rawFacultyList, capacityList, workloadAgg] = await Promise.all([
      Faculty.find(facultyMatch).lean(),
      FacultyCapacity.find(capacityFilter).lean(),
      Workload.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$empId',
            name: { $first: '$empName' },
            designation: { $first: '$designation' },
            courseCount: { $sum: 1 },
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
            }
          }
        }
      ])
    ]);

    // Deduplicate faculty by empId
    const facultyMap = new Map();
    for (const f of rawFacultyList) {
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

    const { getDefaultCapacity } = require('../utils/designationUtils');
    // Build capacity map: empId -> capacity (semester-specific, fallback to faculty.capacity)
    const capacityMap = new Map();
    capacityList.forEach(c => {
      if (c.capacity != null) capacityMap.set(c.empId, Number(c.capacity));
    });
    facultyList.forEach(f => {
      if (!capacityMap.has(f.empId)) {
        capacityMap.set(f.empId, Number(f.capacity || getDefaultCapacity(f.designation)));
      }
    });

    const workloadMap = new Map();
    workloadAgg.forEach(w => {
      workloadMap.set(w._id, {
        assignedHours: Number(w.assignedHours) || 0,
        courseCount: Number(w.courseCount) || 0
      });
    });

    const overloaded = [];
    const pending = [];
    const perfect = [];

    facultyList.forEach(f => {
      const wData = workloadMap.get(f.empId) || { assignedHours: 0, courseCount: 0 };
      const defaultCap = getDefaultCapacity(f.designation);
      const capacity = capacityMap.get(f.empId) || Number(f.capacity || defaultCap);
      const assignedHours = wData.assignedHours;
      const pendingLoad = capacity - assignedHours;

      const facultyStat = {
        empId: f.empId,
        name: f.name,
        designation: f.designation || '',
        capacity,
        assignedHours,
        pendingLoad,
        overloadStatus: assignedHours > capacity ? 'Overload' : 'Normal',
        courseCount: wData.courseCount,
      };

      if (assignedHours > capacity) {
        overloaded.push(facultyStat);
      } else if (assignedHours < capacity) {
        pending.push(facultyStat);
      } else {
        perfect.push(facultyStat);
      }
    });

    overloaded.sort((a, b) => b.assignedHours - a.assignedHours);
    pending.sort((a, b) => b.assignedHours - a.assignedHours);
    perfect.sort((a, b) => b.assignedHours - a.assignedHours);

    // Fully dynamic designation-wise counts, workload, and capacity from database
    const Designation = require('../models/Designation');
    const allDesignations = await Designation.find({ isEnabled: true }).sort({ order: 1, name: 1 }).lean();

    const designationStats = allDesignations.map((desig) => {
      const desigIdStr = String(desig._id);
      const desigNameClean = desig.name.trim().toLowerCase();

      // Match faculty by stable designationId or designation name
      const matchingFaculty = facultyList.filter(f => {
        if (f.designationId && String(f.designationId) === desigIdStr) return true;
        const fDesig = String(f.designation || '').trim().toLowerCase();
        return fDesig === desigNameClean;
      });

      let totalCapacity = 0;
      let totalAllocated = 0;
      const list = matchingFaculty.map(f => {
        const wData = workloadMap.get(f.empId) || { assignedHours: 0, courseCount: 0 };
        const defaultCap = getDefaultCapacity(f.designation);
        const cap = capacityMap.get(f.empId) || Number(f.capacity || defaultCap);
        const assigned = wData.assignedHours || 0;
        totalCapacity += cap;
        totalAllocated += assigned;
        return {
          empId: f.empId,
          name: f.name,
          designation: f.designation,
          designationId: desigIdStr,
          capacity: cap,
          assignedHours: assigned,
          remainingCapacity: cap - assigned,
          courseCount: wData.courseCount || 0,
          status: assigned > cap ? 'Overload' : (assigned === cap && cap > 0 ? 'Normal' : 'Normal')
        };
      });

      const remainingCapacity = totalCapacity - totalAllocated;
      return {
        id: desigIdStr,
        designationId: desigIdStr,
        designation: desig.name,
        name: desig.name,
        order: desig.order ?? 0,
        count: matchingFaculty.length,
        totalCapacity,
        totalAllocated,
        remainingCapacity,
        isOverloaded: totalAllocated > totalCapacity,
        faculty: list,
      };
    });

    res.json({
      success: true,
      data: {
        overloaded,
        pending,
        perfect,
        designationStats,
        taDesignationStats: designationStats,
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stats/overloaded-faculty
 * Retrieve list of all overloaded faculty with detailed breakdown and assignments
 * Admin only
 */
router.get('/overloaded-faculty', requireAuth, requireAdmin, requireAcademicPeriod, async (req, res, next) => {
  try {
    const semester = req.query.semester;
    const periodStart = req.academicPeriod?.periodStart || req.academicPeriod?.academicYear?.startDate;
    const periodEnd = req.academicPeriod?.periodEnd || req.academicPeriod?.academicYear?.endDate;
    const report = await getFacultyWorkloadReport(null, semester, periodStart, periodEnd);
    const overloadedFaculty = report.filter(f => f.isOverAllocated);

    res.json({
      success: true,
      data: {
        count: overloadedFaculty.length,
        faculty: overloadedFaculty.map(f => ({
          empId: f.empId,
          name: f.name,
          designation: f.designation,
          department: f.department,
          totalCapacity: f.totalCapacity,
          currentLoad: f.currentLoad,
          remainingHours: f.remainingHours,
          excessHours: Math.max(0, f.currentLoad - f.totalCapacity),
          utilizationPercent: f.utilizationPercent,
          isOverAllocated: f.isOverAllocated,
          assignmentCount: f.assignmentCount,
          assignments: f.assignments.map(a => ({
            id: a.id,
            subjectCode: a.subjectCode,
            subjectName: a.subjectName,
            year: a.year,
            section: a.section,
            role: a.role,
            lectureHours: a.lectureHours,
            tutorialHours: a.tutorialHours,
            practicalHours: a.practicalHours,
            totalHours: a.totalHours,
          })),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stats/faculty-workload/:empId
 * Retrieve detailed workload summary for a specific faculty member
 * Admin only
 */
router.get('/faculty-workload/:empId', requireAuth, requireSelfOrAdmin, requireAcademicPeriod, async (req, res, next) => {
  try {
    const { empId } = req.params;
    const semester = req.query.semester || null;
    const academicYear = req.query.academicYear || null;
    const summary = await getFacultyWorkloadSummary(empId, null, null, semester, academicYear);

    res.json({
      success: true,
      data: {
        empId: summary.empId,
        name: summary.name,
        designation: summary.designation,
        totalCapacity: summary.capacity,
        currentLoad: summary.currentLoad,
        remainingHours: summary.remaining,
        excessHours: Math.max(0, summary.currentLoad - summary.capacity),
        utilizationPercent: summary.workloadPercentage,
        isOverAllocated: summary.isOverAllocated,
        assignments: summary.assignments,
        breakdown: summary.breakdown,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stats/designations/:id/details
 * Retrieve designation workload and faculty details
 * Admin only
 */
router.get('/designations/:id/details', requireAuth, requireAdmin, requireAcademicPeriod, async (req, res, next) => {
  try {
    const desigParam = String(req.params.id || '').trim();
    if (!desigParam) return sendError(res, 'Designation ID is required.', 400);

    const mongoose = require('mongoose');
    const Designation = require('../models/Designation');
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

    const periodStart = req.academicPeriod?.periodStart || req.academicPeriod?.academicYear?.startDate;
    const periodEnd = req.academicPeriod?.periodEnd || req.academicPeriod?.academicYear?.endDate;
    const periodFilter = req.getPeriodFilter ? req.getPeriodFilter() : {};
    const academicYear = req.academicPeriod?.academicYear?.name || req.query.academicYear || '';
    const semester = req.academicPeriod?.academicYearSemester?.semesterType || req.query.semester || '';

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

    const FacultyCapacity = require('../models/FacultyCapacity');
    const capFilter = {
      empId: { $in: empIds },
      ...(req.getSemesterId && req.getSemesterId() ? periodFilter : {})
    };
    const capacities = await FacultyCapacity.find(capFilter).lean();
    const capacityByEmpId = new Map();
    capacities.forEach(c => {
      if (c.capacity != null) capacityByEmpId.set(String(c.empId).trim(), Number(c.capacity));
    });

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
    logger.error('Error fetching designation details in stats', { error: err.message });
    next(err);
  }
});

module.exports = router;

