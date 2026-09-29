'use strict';

const express = require('express');
const Designation = require('../models/Designation');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendSuccess, sendError, sendValidationError, sendConflict, sendNotFound, sendCreated, sendPaginated } = require('../utils/response');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/designations (accessible by all authenticated users to populate dropdowns)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const docs = await Designation.find({ isEnabled: true }).sort({ order: 1 }).lean();
    sendSuccess(res, docs.map(d => d.name), 200);
  } catch (err) {
    logger.error('Error listing designations', { error: err.message });
    next(err);
  }
});

// GET /api/designations/admin (Admin only - raw objects)
router.get('/admin', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const docs = await Designation.find().sort({ order: 1 }).lean();
    sendSuccess(res, docs, 200);
  } catch (err) {
    logger.error('Error listing admin designations', { error: err.message });
    next(err);
  }
});

// POST /api/designations (Admin only)
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, order, isEnabled } = req.body;
    if (!name || !name.trim()) return sendError(res, 'Designation name is required.', 400);

    const doc = await Designation.create({ name: name.trim(), order: order || 0, isEnabled: isEnabled !== false });
    sendSuccess(res, doc, 201);
  } catch (err) {
    logger.error('Error creating designation', { error: err.message });
    next(err);
  }
});

// PUT /api/designations/:id (Admin only)
router.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, order, isEnabled } = req.body;
    const doc = await Designation.findByIdAndUpdate(
      req.params.id,
      { name: name?.trim(), order, isEnabled },
      { new: true, runValidators: true }
    );
    if (!doc) return sendNotFound(res, 'Designation not found');
    sendSuccess(res, doc, 200);
  } catch (err) {
    logger.error('Error updating designation', { error: err.message });
    next(err);
  }
});

// DELETE /api/designations/:id (Admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const doc = await Designation.findByIdAndDelete(req.params.id);
    if (!doc) return sendNotFound(res, 'Designation not found');
    sendSuccess(res, { message: 'Designation deleted' }, 200);
  } catch (err) {
    logger.error('Error deleting designation', { error: err.message });
    next(err);
  }
});

module.exports = router;
