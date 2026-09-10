'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const SystemConfig = require('../models/SystemConfig');
const { refreshConfig, getConfig } = require('../utils/configManager');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

// GET /api/config
// Publicly accessible to authenticated users (used by frontend to populate dropdowns)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const config = await getConfig();
    sendSuccess(res, config, 200);
  } catch (err) {
    next(err);
  }
});

// PUT /api/config
// Admin only: Overwrite the configuration lists
router.put('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { years, courseTypes, facultyRoles, designations, departments } = req.body;
    
    // Construct update payload (only update provided arrays)
    const update = {};
    if (Array.isArray(years)) update.years = years;
    if (Array.isArray(courseTypes)) update.courseTypes = courseTypes;
    if (Array.isArray(facultyRoles)) update.facultyRoles = facultyRoles;
    if (Array.isArray(designations)) update.designations = designations;
    if (Array.isArray(departments)) update.departments = departments;

    if (Object.keys(update).length === 0) {
      return sendError(res, 'No valid configuration lists provided.', 400);
    }

    const config = await SystemConfig.findOneAndUpdate(
      { singletonFlag: 'config' },
      { $set: update },
      { new: true, upsert: true }
    );

    // Forcibly invalidate cache so new requests use new config
    await refreshConfig();

    logger.info('System configuration updated', { adminId: req.user.id, keys: Object.keys(update) });
    sendSuccess(res, config, 200);
  } catch (err) {
    logger.error('Failed to update system config', { error: err.message, adminId: req.user.id });
    next(err);
  }
});

module.exports = router;
