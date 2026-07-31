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
const { requireAuth, requireAdmin, requireSelfOrAdmin } = require('../middleware/auth');
const { getFacultyWorkloadSummary, getFacultyWorkloadReport } = require('../utils/workloadHours');

const router = express.Router();

const sec = (n) => Array.from({ length: n }, (_, i) => String(i + 1));
const DEFAULT_SECTIONS = {
  I: sec(19), II: sec(22), III: sec(19), IV: sec(9), 'M.Tech': ['1', '2'],
};

const getSectionsConfig = async () => {
  const doc = await Setting.findOne({ key: 'sections_config' }).lean();
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

    // 2. Ensure all Faculty have a User account
    const missingUsers = await Faculty.aggregate([
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
      const passwordHash = bcrypt.hashSync(defaultPassword, 10);
      
      await User.create({
        empId,
        name: f.name || 'Unknown',
        designation: f.designation || 'Faculty',
        mobile: f.mobile || '',
        email: f.email || '',
        passwordHash,
        role: 'faculty', // Assuming role is lowercase 'faculty' based on auth defaults
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
        { $group: { _id: '$subjectCode', count: { $sum: 1 }, ids: { $push: '$_id' } } },
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

router.get('/', requireAuth, async (req, res, next) => {
  try {
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
      Faculty.countDocuments(),
      Course.countDocuments(),
      Submission.countDocuments(),
      Workload.countDocuments(),
      Course.aggregate([{ $group: { _id: null, total: { $sum: '$C' } } }]),
      Faculty.aggregate([{ $group: { _id: '$designation', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Course.aggregate([{ $group: { _id: '$program', count: { $sum: 1 } } }]),
      Course.aggregate([{ $group: { _id: '$courseType', count: { $sum: 1 } } }]),
      Workload.aggregate([
        {
          $group: {
            _id: '$empId',
            empName:          { $first: '$empName' },
            designation:      { $first: '$designation' },
            coursesAssigned:  { $sum: 1 },
            totalCredits:     { $sum: '$C' },
            totalHours:       { $sum: { $add: ['$manualL', '$manualT', '$manualP'] } },
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
router.get('/dashboard-analytics', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { year, section } = req.query;

    const matchStage = {};
    if (year && year !== 'All') matchStage.year = String(year);
    if (section && section !== 'All') matchStage.section = String(section);

    const [facultyList, workloadAgg, courseAllocations, courses, sectionsConfig] = await Promise.all([
      Faculty.find().lean(),
      Workload.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$empId',
            name: { $first: '$empName' },
            designation: { $first: '$designation' },
            courseCount: { $sum: 1 },
            assignedHours: { $sum: { $add: [{ $ifNull: ['$manualL', 0] }, { $ifNull: ['$manualT', 0] }, { $ifNull: ['$manualP', 0] }] } },
            courseCount: { $sum: 1 }
          }
        }
      ]),
      CourseAllocation.find(matchStage).lean(),
      Course.find(year && year !== 'All' ? { year: String(year) } : {}).lean(),
      getSectionsConfig()
    ]);

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
      const capacity = Number(f.capacity) || 18;
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
      } else if (capacity > 0 && assignedHours === capacity) {
        perfect.push(facultyStat);
      }
    });

    overloaded.sort((a, b) => b.assignedHours - a.assignedHours);
    pending.sort((a, b) => b.assignedHours - a.assignedHours);
    perfect.sort((a, b) => b.assignedHours - a.assignedHours);

    const fullyAllocatedCourses = [];
    const partiallyAllocatedCourses = [];
    const notAllocatedCourses = [];

    // Group course allocations by courseId and year
    const allocationMap = new Map();
    courseAllocations.forEach(c => {
      const isAllocated = 
        (c.lectureSlots && c.lectureSlots.some(s => s?.empId)) ||
        (c.lectureSlot && c.lectureSlot.empId) ||
        (c.tutorialSlots && c.tutorialSlots.some(s => s?.empId)) ||
        (c.practicalSlots && c.practicalSlots.some(s => s?.empId));
      
      const key = `${c.courseId}_${c.year}`;
      if (!allocationMap.has(key)) {
        allocationMap.set(key, { sections: new Map() });
      }
      
      const courseGroup = allocationMap.get(key);
      const assignedFacultyNames = [];
      const extractNames = (slots) => {
        if (!slots) return;
        slots.forEach(s => {
          if (s?.empId) {
            const fac = facultyList.find(f => String(f.empId) === String(s.empId));
            if (fac) assignedFacultyNames.push(fac.name);
          }
        });
      };
      extractNames(c.lectureSlots);
      if (c.lectureSlot?.empId) extractNames([c.lectureSlot]);
      extractNames(c.tutorialSlots);
      extractNames(c.practicalSlots);

      courseGroup.sections.set(c.section, {
        isAllocated,
        assignedFaculty: assignedFacultyNames
      });
    });

    courses.forEach(course => {
      // If course has no year defined, we cannot determine its target sections, so skip.
      if (!course.year) return;
      
      // Get expected sections based on course year
      const expectedSections = sectionsConfig[course.year] || [];
      if (expectedSections.length === 0) return;

      const key = `${course.courseId}_${course.year}`;
      const courseAllocationsData = allocationMap.get(key) || { sections: new Map() };
      
      const allocatedSectionsList = [];
      const remainingSectionsList = [];
      const assignedFacultySet = new Set();

      expectedSections.forEach(sec => {
        // If a sectionFilter is applied, we only consider that section for status calculation
        if (section && section !== 'All' && String(sec) !== String(section)) return;

        const allocData = courseAllocationsData.sections.get(String(sec));
        if (allocData && allocData.isAllocated) {
          allocatedSectionsList.push(String(sec));
          allocData.assignedFaculty.forEach(name => assignedFacultySet.add(name));
        } else {
          remainingSectionsList.push(String(sec));
        }
      });

      // If filtering section caused all expected sections to be skipped, skip this course
      if (allocatedSectionsList.length === 0 && remainingSectionsList.length === 0) return;

      const courseStat = {
        courseId: course.courseId,
        subjectCode: course.subjectCode || '',
        subjectName: course.subjectName || '',
        year: course.year || '',
        allocatedSections: allocatedSectionsList.join(', '),
        remainingSections: remainingSectionsList.join(', '),
        assignedFaculty: Array.from(assignedFacultySet).join(', ') || 'None',
        status: ''
      };

      if (remainingSectionsList.length === 0) {
        courseStat.status = 'Fully Allocated';
        fullyAllocatedCourses.push(courseStat);
      } else if (allocatedSectionsList.length > 0) {
        courseStat.status = 'Partially Allocated';
        partiallyAllocatedCourses.push(courseStat);
      } else {
        courseStat.status = 'Not Allocated';
        notAllocatedCourses.push(courseStat);
      }
    });

    res.json({
      success: true,
      data: {
        overloaded,
        pending,
        perfect,
        fullyAllocatedCourses,
        partiallyAllocatedCourses,
        notAllocatedCourses
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
router.get('/overloaded-faculty', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const report = await getFacultyWorkloadReport();
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
router.get('/faculty-workload/:empId', requireAuth, requireSelfOrAdmin, async (req, res, next) => {
  try {
    const { empId } = req.params;
    const summary = await getFacultyWorkloadSummary(empId);

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

module.exports = router;

