'use strict';

const express = require('express');
const { mongoose } = require('../db');
const Course = require('../models/Course');
const CourseOffering = require('../models/CourseOffering');
const Section = require('../models/Section');
const AcademicYearSection = require('../models/AcademicYearSection');
const CourseAllocation = require('../models/CourseAllocation');
const AcademicYear = require('../models/AcademicYear');
const AcademicYearSemester = require('../models/AcademicYearSemester');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

/**
 * GET /api/course-loads/filters
 */
router.get('/filters', requireAuth, async (req, res) => {
  try {
    // 1. Get Academic Years from DB
    const academicYearsDocs = await AcademicYear.find({ status: { $ne: 'ARCHIVED' } }).sort({ name: -1 }).lean();
    const academicYears = academicYearsDocs.map(ay => ay.name);
    
    // 2. Get Semester Types from DB
    const semesterTypes = await AcademicYearSemester.distinct('semesterType');
    
    // 3. Get Programs and Years per program dynamically from actual active course offerings
    const activeOfferings = await CourseOffering.find({ status: 'Active' }).lean();
    const courseIds = activeOfferings.map(o => o.courseId);
    
    const courses = await Course.find({ _id: { $in: courseIds }, isDeleted: { $ne: true } }).lean();
    
    const yearsPerProgram = {};
    for (const c of courses) {
      if (!c.program || !c.year) continue;
      if (!yearsPerProgram[c.program]) yearsPerProgram[c.program] = new Set();
      yearsPerProgram[c.program].add(c.year);
    }
    
    const programs = Object.keys(yearsPerProgram).sort();
    const finalYearsPerProgram = {};
    for (const p of programs) {
      finalYearsPerProgram[p] = Array.from(yearsPerProgram[p]).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
    }

    return sendSuccess(res, {
      academicYears,
      semesterTypes,
      programs,
      yearsPerProgram: finalYearsPerProgram
    });
  } catch (error) {
    console.error('Error fetching course loads filters:', error);
    return sendError(res, 500, 'Failed to fetch filters');
  }
});

/**
 * GET /api/course-loads
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    // Disable caching to prevent stale allocation data
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { academicYear, semesterType, program, year, search } = req.query;

    if (!academicYear || !semesterType) {
      return sendError(res, 400, 'academicYear and semesterType are required parameters');
    }

    // 1. Resolve AcademicYear and Semester
    const ayDoc = await AcademicYear.findOne({ name: academicYear }).lean();
    if (!ayDoc) return sendSuccess(res, []);
    
    const semDoc = await AcademicYearSemester.findOne({ academicYearId: ayDoc._id, semesterType }).lean();
    if (!semDoc) return sendSuccess(res, []);

    // 2. Fetch the Section Universe from SystemConfig (single source of truth for table columns)
    const Setting = require('../models/Setting');
    let configDoc = await Setting.findOne({ key: `sections_config_${academicYear}_${semesterType}` }).lean();
    if (!configDoc) configDoc = await Setting.findOne({ key: `sections_config_${academicYear}` }).lean();
    if (!configDoc) configDoc = await Setting.findOne({ key: 'sections_config' }).lean();
    const sectionsConfig = configDoc && configDoc.value ? JSON.parse(configDoc.value) : {};

    // 3. Start from CourseOffering with Aggregation to ensure one row per offered course
    const pipeline = [
      { $match: { academicYearSemesterId: semDoc._id, status: 'Active' } },
      {
        $lookup: {
          from: 'courses',
          localField: 'courseId',
          foreignField: '_id',
          as: 'course'
        }
      },
      { $unwind: '$course' },
      { $match: { 'course.isDeleted': { $ne: true } } }
    ];

    if (program) pipeline.push({ $match: { 'course.program': program } });
    if (year) pipeline.push({ $match: { 'course.year': year } });
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'course.subjectCode': new RegExp(search, 'i') },
            { 'course.subjectName': new RegExp(search, 'i') },
            { 'course.shortName': new RegExp(search, 'i') }
          ]
        }
      });
    }

    // Lookup Allocations using scoped join (matching course._id or course.courseId)
    // Applying delete convention in the join
    pipeline.push({
      $lookup: {
        from: 'allocations',
        let: { courseObjId: '$course._id', legacyCid: '$course.courseId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$academicYear', academicYear] },
                  { $eq: ['$semester', semesterType] },
                  { $ne: ['$isDeleted', true] },
                  {
                    $or: [
                      { $eq: ['$course', '$$courseObjId'] },
                      {
                        $and: [
                          { $ne: ['$$legacyCid', null] },
                          { $ne: ['$$legacyCid', undefined] },
                          { $eq: ['$courseId', '$$legacyCid'] }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          },
          { $project: { _id: 0, section: { $trim: { input: '$section' } } } }
        ],
        as: 'allocations'
      }
    });

    // Extract unique allocated sections natively in Mongo
    pipeline.push({
      $addFields: {
        allocatedSections: {
          $setUnion: [
            { $map: { input: '$allocations', as: 'a', in: '$$a.section' } },
            []
          ]
        }
      }
    });

    const results = await CourseOffering.aggregate(pipeline);

    // Grouping Program -> Year and calculating Not Allocated based on the strict universe
    const groupedData = {};

    for (const row of results) {
      const c = row.course;
      const prog = c.program || 'Other';
      const yr = c.year || 'Other';

      // Scope key for universe
      const yearKey = prog === 'M.Tech' ? `M.Tech_${yr}` : yr;
      const universe = sectionsConfig[yearKey] || [];

      // Filter allocated to only include those in the universe, sorting naturally
      const allocated = row.allocatedSections
        .filter(s => universe.includes(s))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      // Not Allocated = Universe minus Allocated
      const allocatedSet = new Set(allocated);
      const notAllocated = universe
        .filter(s => !allocatedSet.has(s))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      if (!groupedData[prog]) groupedData[prog] = {};
      if (!groupedData[prog][yr]) groupedData[prog][yr] = [];

      groupedData[prog][yr].push({
        courseCode: c.subjectCode,
        courseName: c.subjectName,
        allocatedSections: allocated,
        notAllocatedSections: notAllocated
      });
    }

    // Convert to arrays and sort properly
    const finalResult = [];
    const sortedPrograms = Object.keys(groupedData).sort();
    
    for (const prog of sortedPrograms) {
      const yearsObj = groupedData[prog];
      const sortedYears = Object.keys(yearsObj).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      
      const yearsArr = [];
      for (const yr of sortedYears) {
        const coursesList = yearsObj[yr].sort((a, b) => a.courseCode.localeCompare(b.courseCode));
        yearsArr.push({
          year: yr,
          courses: coursesList
        });
      }
      
      finalResult.push({
        program: prog,
        years: yearsArr
      });
    }

    return sendSuccess(res, finalResult);
  } catch (error) {
    console.error('Error fetching course loads:', error);
    return sendError(res, 500, 'Failed to fetch course loads');
  }
});

/**
 * GET /api/course-loads/diagnostics
 */
router.get('/diagnostics', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { academicYear, semesterType } = req.query;
    if (!academicYear || !semesterType) {
      return sendError(res, 400, 'academicYear and semesterType required');
    }

    const ayDoc = await AcademicYear.findOne({ name: academicYear }).lean();
    if (!ayDoc) return sendSuccess(res, { report: 'Academic Year not found' });
    const semDoc = await AcademicYearSemester.findOne({ academicYearId: ayDoc._id, semesterType }).lean();
    if (!semDoc) return sendSuccess(res, { report: 'Semester not found' });

    const offerings = await CourseOffering.find({ academicYearSemesterId: semDoc._id, status: 'Active' }).lean();
    const courseIds = offerings.map(o => o.courseId);
    
    const courses = await Course.find({ _id: { $in: courseIds }, isDeleted: { $ne: true } }).lean();
    
    const gtGroups = {};
    courses.forEach(c => {
      const key = `${c.program} -> ${c.year}`;
      gtGroups[key] = (gtGroups[key] || 0) + 1;
    });

    const allocs = await CourseAllocation.aggregate([
      { $match: { academicYear, semester: semesterType, isDeleted: { $ne: true } } },
      { $group: { _id: { courseId: "$courseId", course: "$course", section: "$section" }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } }
    ]);

    return sendSuccess(res, {
      groundTruthOfferingsCount: courses.length,
      offeringsByProgramYear: gtGroups,
      duplicateAllocations: allocs,
      message: 'Diagnostics completed successfully. Compare groundTruthOfferingsCount with your UI.'
    });

  } catch (error) {
    console.error(error);
    return sendError(res, 500, 'Failed to run diagnostics');
  }
});

module.exports = router;
