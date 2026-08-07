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

// POST /api/designations (Admin only)
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, order } = req.body;
    if (!name || !name.trim()) return sendError(res, 'Designation name is required.', 400);

    const doc = await Designation.create({ name: name.trim(), order: order || 0 });
    sendSuccess(res, doc, 201);
  } catch (err) {
    logger.error('Error creating designation', { error: err.message });
    next(err);
  }
});

module.exports = router;
