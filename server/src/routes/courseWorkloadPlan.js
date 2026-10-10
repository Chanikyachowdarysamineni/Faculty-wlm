const express = require('express');
const router = express.Router();
const { sendError } = require('../utils/response');
const mongoose = require('mongoose');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const requireAcademicPeriod = require('../middleware/academicPeriod');
const CourseWorkloadPlan = require('../models/CourseWorkloadPlan');
const CourseOffering = require('../models/CourseOffering');

// GET /api/course-workload-plan
// Fetch all workload plans for the active semester, outer joined with CourseOfferings
router.get('/', requireAuth, requireAcademicPeriod, async (req, res, next) => {
  try {
    const semId = req.getSemesterId();
    const semType = req.academicPeriod?.academicYearSemester?.semesterType;
    const academicYearId = req.academicPeriod?.academicYear?._id;
    
    if (!semId || !semType || !academicYearId) {
      return res.json({ success: true, data: [] });
    }

    // Get all active course offerings for this semester
    let offerings = await CourseOffering.find({ 
      academicYearSemesterId: semId, 
      status: { $ne: 'Cancelled' }
    }).populate('courseId').lean();

    // Filter out offerings where the course was deleted or hard-deleted
    offerings = offerings.filter(o => o.courseId && o.courseId.isDeleted !== true);

    // Get all plans for this academic year + semester
    const plans = await CourseWorkloadPlan.find({
      academicYearId,
      semesterType: semType
    }).lean();

    const planMap = {};
    plans.forEach(p => {
      planMap[p.courseOfferingId.toString()] = p;
    });

    const result = offerings.map(offering => {
      const course = offering.courseId || {};
      const plan = planMap[offering._id.toString()] || {};

      const L = offering.L ?? course.L ?? 0;
      const T = offering.T ?? course.T ?? 0;
      const P = offering.P ?? course.P ?? 0;
      const C = offering.credits ?? course.C ?? 0;

      const tpBatches = plan.tpBatches || 0;
      const noOfSections = plan.noOfSections || 0;
      const studentStrength = plan.studentStrength || 0;

      const totalL = noOfSections * L;
      const totalT = T * tpBatches * noOfSections;
      const totalP = P * tpBatches * noOfSections;
      const total = totalL + totalT + totalP;

      return {
        _id: plan._id || null,
        courseOfferingId: offering._id,
        program: course.program || '',
        year: course.year || '',
        semester: semType,
        subjectName: course.subjectName || '',
        shortName: course.shortName || '',
        subjectCode: course.subjectCode || '',
        courseType: course.courseType || '',
        L,
        T,
        P,
        C,
        tpBatches,
        noOfSections,
        studentStrength,
        totalL,
        totalT,
        totalP,
        total
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// PUT /api/course-workload-plan/:courseOfferingId
// Upsert a workload plan
router.put('/:courseOfferingId', requireAuth, requireAdmin, requireAcademicPeriod, async (req, res, next) => {
  try {
    const semType = req.academicPeriod?.academicYearSemester?.semesterType;
    const academicYearId = req.academicPeriod?.academicYear?._id;
    const { courseOfferingId } = req.params;
    const { tpBatches, noOfSections, studentStrength } = req.body;

    if (!semType || !academicYearId) {
      return sendError(res, 'Validation failed', 400);
    }

    const plan = await CourseWorkloadPlan.findOneAndUpdate(
      { academicYearId, semesterType: semType, courseOfferingId },
      {
        $set: {
          tpBatches: Number(tpBatches) || 0,
          noOfSections: Number(noOfSections) || 0,
          studentStrength: Number(studentStrength) || 0,
          updatedBy: req.user?._id?.toString() || 'Admin'
        }
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, message: 'Saved successfully', data: plan });
  } catch (err) {
    next(err);
  }
});

// PUT /api/course-workload-plan/bulk
// Upsert multiple workload plans
router.put('/bulk/update', requireAuth, requireAdmin, requireAcademicPeriod, async (req, res, next) => {
  try {
    const semType = req.academicPeriod?.academicYearSemester?.semesterType;
    const academicYearId = req.academicPeriod?.academicYear?._id;
    const { items } = req.body;

    if (!semType || !academicYearId) {
      return sendError(res, 'Validation failed', 400);
    }
    
    if (!Array.isArray(items)) {
      return sendError(res, 'Validation failed', 400);
    }

    const bulkOps = items.map(item => ({
      updateOne: {
        filter: { 
          academicYearId, 
          semesterType: semType, 
          courseOfferingId: item.courseOfferingId 
        },
        update: { 
          $set: {
            tpBatches: Number(item.tpBatches) || 0,
            noOfSections: Number(item.noOfSections) || 0,
            studentStrength: Number(item.studentStrength) || 0,
            updatedBy: req.user?._id?.toString() || 'Admin'
          }
        },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      await CourseWorkloadPlan.bulkWrite(bulkOps);
    }

    res.json({ success: true, message: 'Saved successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
