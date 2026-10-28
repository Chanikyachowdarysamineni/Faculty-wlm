'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const Section = require('../models/Section');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const requireAcademicPeriod = require('../middleware/academicPeriod');
const { sendSuccess, sendError, sendValidationError, sendCreated } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const wsHandler = require('../websocket');

const router = express.Router();

const normalizeYear = (year) => {
  const trimmed = String(year || '').trim();
  const upper = trimmed.toUpperCase();
  if (upper === 'I' || upper === '1') return 'I';
  if (upper === 'II' || upper === '2') return 'II';
  if (upper === 'III' || upper === '3') return 'III';
  if (upper === 'IV' || upper === '4') return 'IV';
  if (upper === 'V' || upper === '5') return 'V';
  if (upper === 'VI' || upper === '6') return 'VI';
  if (upper === 'M.TECH_I' || upper === 'MTECH_I' || upper === 'M.TECH-I' || upper === 'MTECH I') return 'M.Tech_I';
  if (upper === 'M.TECH_II' || upper === 'MTECH_II' || upper === 'M.TECH-II' || upper === 'MTECH II') return 'M.Tech_II';
  return trimmed;
};

// Validation rules
const sectionValidation = [
  body('name').trim().notEmpty().withMessage('Section name is required'),
  body('year')
    .trim()
    .notEmpty()
    .withMessage('Valid year is required')
    .customSanitizer(normalizeYear),
  body('department').optional().trim(),
  body('status').optional().isIn(['Active', 'Inactive']),
];

// GET /api/sections - List sections
router.get('/', requireAuth, requireAcademicPeriod, async (req, res, next) => {
  try {
    const { page = 1, limit = 1000 } = req.query; // Higher limit for master data
    const skip = (page - 1) * limit;
    const filter = { isDeleted: false };
    
    if (req.query.year) filter.year = normalizeYear(req.query.year);
    if (req.query.department) filter.department = req.query.department;
    if (req.query.status) filter.status = req.query.status;

    const [total, docs] = await Promise.all([
      Section.countDocuments(filter),
      Section.find(filter).sort({ year: 1, name: 1 }).skip(Number(skip)).limit(Number(limit)).lean()
    ]);

    res.json({
      success: true,
      data: docs,
      meta: { total, page: Number(page), limit: Number(limit) }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sections - Create section
router.post('/', requireAuth, requireAdmin, sectionValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendValidationError(res, errors.array());

  try {
    const { name, year, department, status } = req.body;
    const newSection = new Section({
      name: String(name || '').trim(),
      year: normalizeYear(year),
      department: department ? String(department).trim() : 'CSE',
      status: status || 'Active',
      isDeleted: false
    });
    
    await newSection.save();
    
    wsHandler.broadcast({
      type: 'sections_updated',
      data: { action: 'create', section: newSection }
    });

    sendCreated(res, newSection);
  } catch (err) {
    next(err);
  }
});

// PUT /api/sections/:id - Update section
router.put('/:id', requireAuth, requireAdmin, sectionValidation, async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendValidationError(res, errors.array());

  try {
    // H-1: Whitelist allowed fields instead of using req.body directly (prevents mass assignment)
    const { name, year, department, status } = req.body;
    const updated = await Section.findByIdAndUpdate(
      req.params.id,
      { $set: { name, year, department, status } },
      { new: true, runValidators: true }
    );
    
    if (!updated) return res.status(404).json({ success: false, message: 'Section not found' });
    
    wsHandler.broadcast({
      type: 'sections_updated',
      data: { action: 'update', section: updated }
    });

    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sections/:id - Soft delete section
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const section = await Section.findByIdAndUpdate(
      req.params.id,
      { $set: { isDeleted: true, status: 'Inactive' } },
      { new: true }
    );
    
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });
    
    wsHandler.broadcast({
      type: 'sections_updated',
      data: { action: 'delete', sectionId: req.params.id }
    });

    sendSuccess(res, { message: 'Section deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
