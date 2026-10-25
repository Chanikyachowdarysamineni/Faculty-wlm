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
    
    // 3. Get Programs and Years per program
    // A. Distinct programs from Course collection
    const distinctCoursePrograms = await Course.distinct('program', { isDeleted: { $ne: true } });
    
    // B. Configured programs & years from SystemConfig
    let configPrograms = [];
    let configYears = [];
    try {
      const SystemConfig = require('../models/SystemConfig');
      const sysConfig = await SystemConfig.findOne({ singletonFlag: 'config' }).lean();
      configPrograms = (sysConfig?.programs || []).filter(p => p.isActive).map(p => p.value);
      configYears = (sysConfig?.years || []).filter(y => y.isActive && y.value !== 'Other').map(y => y.value);
    } catch (e) {
      // ignore
    }

    // Combine all discovered programs dynamically
    const allProgramsSet = new Set([...configPrograms, ...distinctCoursePrograms.filter(Boolean)]);
    if (allProgramsSet.size === 0) {
      allProgramsSet.add('B.Tech');
      allProgramsSet.add('M.Tech');
    }
    const programs = Array.from(allProgramsSet).sort();

    // Query courses to collect actual years used per program
    const courses = await Course.find({ isDeleted: { $ne: true } }).select('program year').lean();
    const yearsPerProgramMap = {};

    for (const p of programs) {
      yearsPerProgramMap[p] = new Set();
    }

    const romanOrder = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, '1': 1, '2': 2, '3': 3, '4': 4 };
    const numToRoman = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', 'I': 'I', 'II': 'II', 'III': 'III', 'IV': 'IV' };

    for (const c of courses) {
      const prog = c.program || programs[0];
      if (!c.year) continue;
      if (!yearsPerProgramMap[prog]) yearsPerProgramMap[prog] = new Set();
      const canonicalYr = numToRoman[c.year] || String(c.year);
      if (canonicalYr !== 'M.Tech' && canonicalYr !== 'Other') {
        yearsPerProgramMap[prog].add(canonicalYr);
      }
    }

    // For any program without courses yet, seed standard years per program
    for (const p of programs) {
      if (yearsPerProgramMap[p].size === 0) {
        if (p === 'M.Tech') {
          // M.Tech only has 2 years (I and II)
          yearsPerProgramMap[p] = new Set(['I', 'II']);
        } else if (p === 'B.Tech') {
          // B.Tech has 4 years (I, II, III, IV)
          yearsPerProgramMap[p] = new Set(['I', 'II', 'III', 'IV']);
        } else {
          if (configYears.length > 0) {
            configYears.forEach(y => {
              const rom = numToRoman[y] || String(y);
              if (rom !== 'M.Tech' && rom !== 'Other') yearsPerProgramMap[p].add(rom);
            });
          } else {
            ['I', 'II', 'III', 'IV'].forEach(y => yearsPerProgramMap[p].add(y));
          }
        }
      }
    }

    const finalYearsPerProgram = {};
    for (const p of programs) {
      finalYearsPerProgram[p] = Array.from(yearsPerProgramMap[p] || [])
        .sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));
    }

    const allYearsSet = new Set();
    Object.values(finalYearsPerProgram).forEach(list => list.forEach(y => allYearsSet.add(y)));
    const allYears = Array.from(allYearsSet).sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));

    return sendSuccess(res, {
      academicYears,
      semesterTypes,
      programs,
      yearsPerProgram: finalYearsPerProgram,
      allYears
    });
  } catch (error) {
    console.error('Error fetching course loads filters:', error);
    return sendError(res, 'Failed to fetch filters', 500);
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
      return sendError(res, 'academicYear and semesterType are required parameters', 400);
    }

    // 1. Resolve AcademicYear and Semester
    const ayDoc = await AcademicYear.findOne({ name: academicYear }).lean();
    if (!ayDoc) return sendSuccess(res, []);
    
    const semTypeNorm = (semesterType || '').toUpperCase();
    const semDoc = await AcademicYearSemester.findOne({
      academicYearId: ayDoc._id,
      $or: [
        { semesterType: semTypeNorm },
        { semesterType: new RegExp(`^${semesterType}$`, 'i') }
      ]
    }).lean();
    if (!semDoc) return sendSuccess(res, []);

    // 2. Fetch the Section Universe directly from database Setting
    const Setting = require('../models/Setting');
    let configDoc = await Setting.findOne({ key: `sections_config_${academicYear}_${semTypeNorm}` }).lean();
    if (!configDoc) configDoc = await Setting.findOne({ key: `sections_config_${academicYear}_${semesterType}` }).lean();
    if (!configDoc) configDoc = await Setting.findOne({ key: `sections_config_${academicYear}` }).lean();
    if (!configDoc) configDoc = await Setting.findOne({ key: 'sections_config' }).lean();
    
    let sectionsConfig = {};
    if (configDoc && configDoc.value) {
      try {
        sectionsConfig = JSON.parse(configDoc.value);
      } catch (e) {
        sectionsConfig = {};
      }
    }

    // 3. Auto-sync: Ensure all active courses for this academic period have a CourseOffering
    try {
      const activeCourses = await Course.find({
        academicYear,
        semester: new RegExp(`^${semesterType}$`, 'i'),
        isDeleted: { $ne: true }
      }).lean();

      const existingOfferings = await CourseOffering.find({
        academicYearSemesterId: semDoc._id
      }).select('courseId').lean();

      const existingCourseIds = new Set(existingOfferings.map(o => o.courseId.toString()));
      const missingOfferings = [];

      for (const ac of activeCourses) {
        if (!existingCourseIds.has(ac._id.toString())) {
          missingOfferings.push({
            academicYearSemesterId: semDoc._id,
            courseId: ac._id,
            credits: ac.C || 0,
            L: ac.L || 0,
            T: ac.T || 0,
            P: ac.P || 0,
            status: 'Active'
          });
        }
      }

      if (missingOfferings.length > 0) {
        await CourseOffering.insertMany(missingOfferings);
      }
    } catch (syncErr) {
      console.warn('Course offering sync error in courseLoads:', syncErr.message);
    }

    // 4. Start from CourseOffering with Aggregation to ensure one row per offered course
    const pipeline = [
      { $match: { academicYearSemesterId: semDoc._id, status: { $ne: 'Cancelled' } } },
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

    if (program) {
      pipeline.push({ $match: { 'course.program': new RegExp(`^${program}$`, 'i') } });
    }
    if (year) {
      const romanToNum = { 'I': '1', 'II': '2', 'III': '3', 'IV': '4' };
      const numToRoman = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
      const yrVariants = Array.from(new Set([
        String(year),
        romanToNum[year],
        numToRoman[year]
      ].filter(Boolean)));
      pipeline.push({ $match: { 'course.year': { $in: yrVariants } } });
    }
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
      const romanToNum = { 'I': '1', 'II': '2', 'III': '3', 'IV': '4' };
      const numToRoman = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
      const yrNum = romanToNum[yr] || yr;
      const yrRoman = numToRoman[yr] || yr;

      // Check all potential keys in sectionsConfig for this program and year
      const candidateKeys = [
        `${prog}_${yrNum}`,
        `${prog}_${yrRoman}`,
        `${prog}_${yr}`,
        yrNum,
        yrRoman,
        yr
      ];

      let universe = [];
      for (const k of candidateKeys) {
        if (Array.isArray(sectionsConfig[k]) && sectionsConfig[k].length > 0) {
          universe = sectionsConfig[k];
          break;
        }
      }

      // If no configured sections found, universe will be populated from allocated sections below

      // Clean and preserve all actually allocated sections
      const allocated = (row.allocatedSections || [])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      // The full universe should include all configured sections plus any allocated sections
      const fullUniverse = Array.from(new Set([...universe, ...allocated]))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      // Not Allocated = Universe minus Allocated
      const allocatedSet = new Set(allocated);
      const notAllocated = fullUniverse
        .filter(s => !allocatedSet.has(s))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      if (!groupedData[prog]) groupedData[prog] = {};
      if (!groupedData[prog][yr]) groupedData[prog][yr] = [];

      groupedData[prog][yr].push({
        courseCode: c.subjectCode || c.courseCode || '',
        courseName: c.subjectName || c.courseName || '',
        shortName: c.shortName || '',
        courseType: c.courseType || '',
        L: c.L || 0,
        T: c.T || 0,
        P: c.P || 0,
        C: c.C || 0,
        allocatedSections: allocated,
        notAllocatedSections: notAllocated
      });
    }

    // Convert to arrays and sort properly
    const finalResult = [];
    const sortedPrograms = Object.keys(groupedData).sort();
    
    for (const prog of sortedPrograms) {
      const yearsObj = groupedData[prog] || {};
      const romanOrder = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, '1': 1, '2': 2, '3': 3, '4': 4 };
      const sortedYears = Object.keys(yearsObj).sort((a, b) => (romanOrder[a] || 99) - (romanOrder[b] || 99));
      
      const yearsArr = [];
      for (const yr of sortedYears) {
        const coursesList = (yearsObj[yr] || []).sort((a, b) => a.courseCode.localeCompare(b.courseCode));
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
    return sendError(res, 'Failed to fetch course loads', 500);
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
