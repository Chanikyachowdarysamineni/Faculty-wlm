/**
 * routes/firstYear.js
 * API for 1st-Year Courses & Workload Management
 */
'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');

const Workload = require('../models/Workload');
const Faculty = require('../models/Faculty');
const Course = require('../models/Course');

const { requireAuth, requireAdmin } = require('../middleware/auth');

// Validation middleware
const validateAssignment = [
  body('empId').notEmpty().withMessage('Faculty Employee ID is required'),
  body('subjectCode').notEmpty().withMessage('Subject Code is required'),
  body('branch').notEmpty().withMessage('Branch is required'),
  body('workloadText').notEmpty().withMessage('Workload is required'),
];

// Helper to handle validation errors
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array().map(e => e.msg) });
  }
  next();
};

/**
 * @route   GET /api/deva/first-year/assignments
 * @desc    Get all 1st-year assignments
 * @access  Private
 */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  // Fetch assignments where year is 'I' and it is not deleted.
  const assignments = await Workload.find({ year: 'I', isDeleted: false })
    .populate('faculty')
    .populate('course')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: assignments });
}));

/**
 * @route   POST /api/deva/first-year/assignments
 * @desc    Create a 1st-year assignment
 * @access  Admin
 */
router.post('/', requireAdmin, validateAssignment, handleValidation, asyncHandler(async (req, res) => {
  const { empId, subjectCode, branch, sections, workloadText, cluster, academicYear, allocationStatus } = req.body;

  const faculty = await Faculty.findOne({ empId: empId, isDeleted: false });
  if (!faculty) {
    return res.status(404).json({ success: false, message: 'Faculty not found' });
  }

  const course = await Course.findOne({ subjectCode: subjectCode, isDeleted: false });
  if (!course) {
    return res.status(404).json({ success: false, message: 'Course not found' });
  }

  const newAssignment = new Workload({
    faculty: faculty._id,
    course: course._id,
    empId: faculty.empId,
    empName: faculty.name,
    courseId: course.courseId,
    year: 'I', // 1st year
    subjectCode: course.subjectCode,
    subjectName: course.subjectName,
    shortName: course.shortName,
    program: course.program,
    C: course.C,
    designation: faculty.designation,
    mobile: faculty.mobile,
    department: faculty.department,
    
    // First-Year specific fields
    academicYear: academicYear || '2023-2024',
    branch: branch,
    sections: Array.isArray(sections) ? sections : [],
    workloadText: workloadText,
    cluster: cluster || faculty.cluster || '',
    
    facultyRole: 'Main Faculty',
    allocationStatus: allocationStatus || 'ALLOCATED'
  });

  await newAssignment.save();

  if (cluster && faculty.cluster !== cluster) {
    faculty.cluster = cluster;
    await faculty.save();
  }

  res.status(201).json({ success: true, data: newAssignment, message: 'Assignment created successfully' });
}));

/**
 * @route   PUT /api/deva/first-year/assignments/:id
 * @desc    Update a 1st-year assignment
 * @access  Admin
 */
router.put('/:id', requireAdmin, validateAssignment, handleValidation, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { empId, subjectCode, branch, sections, workloadText, cluster, academicYear, allocationStatus } = req.body;

  const assignment = await Workload.findOne({ _id: id, isDeleted: false });
  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Assignment not found' });
  }

  const faculty = await Faculty.findOne({ empId: empId, isDeleted: false });
  if (!faculty) {
    return res.status(404).json({ success: false, message: 'Faculty not found' });
  }

  const course = await Course.findOne({ subjectCode: subjectCode, isDeleted: false });
  if (!course) {
    return res.status(404).json({ success: false, message: 'Course not found' });
  }

  assignment.faculty = faculty._id;
  assignment.empId = faculty.empId;
  assignment.empName = faculty.name;
  assignment.designation = faculty.designation;
  assignment.mobile = faculty.mobile;
  assignment.department = faculty.department;

  assignment.course = course._id;
  assignment.courseId = course.courseId;
  assignment.subjectCode = course.subjectCode;
  assignment.subjectName = course.subjectName;
  assignment.shortName = course.shortName;
  assignment.program = course.program;
  assignment.C = course.C;

  assignment.academicYear = academicYear || '2023-2024';
  assignment.branch = branch;
  assignment.sections = Array.isArray(sections) ? sections : [];
  assignment.workloadText = workloadText;
  assignment.cluster = cluster || faculty.cluster || '';
  if (allocationStatus) {
    assignment.allocationStatus = allocationStatus;
  }

  await assignment.save();

  if (cluster && faculty.cluster !== cluster) {
    faculty.cluster = cluster;
    await faculty.save();
  }

  res.json({ success: true, data: assignment, message: 'Assignment updated successfully' });
}));

/**
 * @route   DELETE /api/deva/first-year/assignments/:id
 * @desc    Delete a 1st-year assignment
 * @access  Admin
 */
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const assignment = await Workload.findOne({ _id: id, isDeleted: false });
  
  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Assignment not found' });
  }

  assignment.isDeleted = true;
  assignment.deletedAt = new Date();
  assignment.updatedBy = req.user ? req.user.id : 'admin';
  await assignment.save();

  res.json({ success: true, message: 'Assignment deleted successfully' });
}));

module.exports = router;
