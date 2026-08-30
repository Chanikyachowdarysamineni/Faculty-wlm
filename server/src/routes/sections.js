'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const Section = require('../models/Section');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendSuccess, sendError, sendValidationError, sendCreated } = require('../utils/response');
const { logAuditEvent } = require('../utils/audit');
const { parsePagination } = require('../utils/pagination');

const router = express.Router();

const normalizeYear = (year) => {
  const trimmed = String(year || '').trim().toUpperCase();
  if (trimmed === 'I' || trimmed === '1') return 'I';
  if (trimmed === 'II' || trimmed === '2') return 'II';
  if (trimmed === 'III' || trimmed === '3') return 'III';
  if (trimmed === 'IV' || trimmed === '4') return 'IV';
  return trimmed;
};

// Validation rules
const sectionValidation = [
  body('name').trim().notEmpty().withMessage('Section name is required'),
  body('year').customSanitizer(normalizeYear).isIn(['I', 'II', 'III', 'IV']).withMessage('Valid year is required'),
  body('department').optional().trim(),
  body('status').optional().isIn(['Active', 'Inactive']),
];

// GET /api/sections - List sections
router.get('/', requireAuth, async (req, res, next) => {
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
    const newSection = new Section({
      ...req.body,
      isDeleted: false
    });
    
    await newSection.save();
    
    await logAuditEvent({ req, action: 'section.create', entity: 'section', entityId: String(newSection._id), metadata: { name: newSection.name, year: newSection.year } });
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
    
    await logAuditEvent({ req, action: 'section.update', entity: 'section', entityId: String(req.params.id), metadata: { name: updated.name, year: updated.year } });
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
    
    await logAuditEvent({ req, action: 'section.delete', entity: 'section', entityId: String(req.params.id), metadata: { name: section.name, year: section.year } });
    sendSuccess(res, { message: 'Section deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
