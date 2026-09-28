'use strict';

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const AcademicYear = require('../models/AcademicYear');
const AcademicYearSemester = require('../models/AcademicYearSemester');
const { sendSuccess, sendError, sendNotFound } = require('../utils/response');

const router = express.Router();

// GET /api/academic-years
// Returns all academic years and their semesters
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const years = await AcademicYear.find().sort({ startDate: -1 }).lean();
    const semesters = await AcademicYearSemester.find().lean();
    
    const result = years.map(year => ({
      ...year,
      id: year._id,
      semesters: semesters
        .filter(s => s.academicYearId.toString() === year._id.toString())
        .map(s => ({ ...s, id: s._id }))
    }));
    
    sendSuccess(res, result, 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/academic-years (Admin only)
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, startDate, endDate } = req.body;
    
    if (!name) return sendError(res, 'Academic year name is required', 400);
    
    const existing = await AcademicYear.findOne({ name: name.trim() });
    if (existing) return sendError(res, 'Academic year already exists', 409);
    
    const isFirst = (await AcademicYear.countDocuments()) === 0;
    
    const newYear = await AcademicYear.create({
      name: name.trim(),
      startDate,
      endDate,
      isCurrent: isFirst,
      status: 'ACTIVE'
    });
    
    // Auto-create semesters
    await AcademicYearSemester.create([
      { academicYearId: newYear._id, semesterType: 'ODD', status: 'NOT_STARTED', formEnabled: false, editEnabled: false },
      { academicYearId: newYear._id, semesterType: 'EVEN', status: 'NOT_STARTED', formEnabled: false, editEnabled: false }
    ]);
    
    const semesters = await AcademicYearSemester.find({ academicYearId: newYear._id }).lean();
    sendSuccess(res, { ...newYear.toObject(), semesters }, 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/academic-years/:id/status (Admin only)
router.put('/:id/status', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status, isCurrent } = req.body;
    const year = await AcademicYear.findById(req.params.id);
    
    if (!year) return sendNotFound(res, 'Academic year not found');
    
    if (status) year.status = status;
    if (isCurrent !== undefined) year.isCurrent = isCurrent; // pre-save hook handles setting others to false
    
    await year.save();
    sendSuccess(res, year, 200);
  } catch (err) {
    next(err);
  }
});

// PUT /api/academic-years/:id/semesters/:type (Admin only)
router.put('/:id/semesters/:type', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status, formEnabled, editEnabled } = req.body;
    const semester = await AcademicYearSemester.findOne({
      academicYearId: req.params.id,
      semesterType: req.params.type.toUpperCase()
    });
    
    if (!semester) return sendNotFound(res, 'Semester not found');
    
    if (status) semester.status = status;
    if (formEnabled !== undefined) semester.formEnabled = formEnabled;
    if (editEnabled !== undefined) semester.editEnabled = editEnabled;
    
    await semester.save();
    sendSuccess(res, semester, 200);
  } catch (err) {
    next(err);
  }
});

// PUT /api/academic-years/:id (Admin only)
router.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, startDate, endDate } = req.body;
    const year = await AcademicYear.findById(req.params.id);
    
    if (!year) return sendNotFound(res, 'Academic year not found');
    
    if (name) year.name = name.trim();
    if (startDate) year.startDate = startDate;
    if (endDate) year.endDate = endDate;
    
    await year.save();
    sendSuccess(res, year, 200);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/academic-years/:id (Admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const year = await AcademicYear.findById(req.params.id);
    if (!year) return sendNotFound(res, 'Academic year not found');
    
    if (year.isCurrent) {
      return sendError(res, 'Cannot delete the current active academic year', 400);
    }
    
    await AcademicYearSemester.deleteMany({ academicYearId: year._id });
    await AcademicYear.deleteOne({ _id: year._id });
    
    sendSuccess(res, { message: 'Academic year deleted successfully' }, 200);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
