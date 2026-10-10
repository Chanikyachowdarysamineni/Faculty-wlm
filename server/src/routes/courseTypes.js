'use strict';

/**
 * routes/courseTypes.js
 *
 * Dedicated CRUD for Course Types, backed by SystemConfig.courseTypes array.
 *
 * GET    /api/course-types          — list all (active + inactive), with usage counts
 * GET    /api/course-types/active   — active only (for dropdowns)
 * POST   /api/course-types          — add new (admin)
 * PUT    /api/course-types/:name    — edit name/label/active (admin)
 * DELETE /api/course-types/:name    — delete if unused, deactivate suggestion (admin)
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const SystemConfig = require('../models/SystemConfig');
const { refreshConfig } = require('../utils/configManager');
const { sendSuccess, sendError, sendNotFound } = require('../utils/response');
const logger = require('../utils/logger');
const { mongoose } = require('../db');

/** Helper: load the singleton config document */
const loadConfig = async () => {
  let cfg = await SystemConfig.findOne({ singletonFlag: 'config' });
  if (!cfg) {
    // No hardcoded array. Just initialize empty.
    cfg = await SystemConfig.create({
      singletonFlag: 'config',
      courseTypes: []
    });
  }
  return cfg;
};

/** Helper: get usage counts per course type from courses collection */
const getUsageCounts = async () => {
  const rows = await mongoose.connection.db.collection('courses').aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $group: { _id: '$courseType', count: { $sum: 1 } } }
  ]).toArray();
  const map = {};
  rows.forEach(r => { map[String(r._id || '').trim()] = r.count; });
  return map;
};

/** Normalize: trim + title-case first letter of each word */
const normalizeName = (raw) =>
  String(raw || '').trim();

// ─────────────────────────────────────────────────────────────────
// GET /api/course-types  — all types with usage counts (auth required)
// ─────────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const cfg = await loadConfig();
    const usage = await getUsageCounts();
    const activeOnly = req.query.active === 'true';

    // Auto-sync missing course types from database (usage) into SystemConfig
    let configModified = false;
    const configuredNames = new Set((cfg.courseTypes || []).map(t => t.value.trim().toLowerCase()));

    Object.keys(usage).forEach(usedName => {
      const trimmed = usedName.trim();
      if (trimmed && !configuredNames.has(trimmed.toLowerCase())) {
        cfg.courseTypes.push({ value: trimmed, label: trimmed, isActive: true });
        configuredNames.add(trimmed.toLowerCase());
        configModified = true;
      }
    });

    if (configModified) {
      await cfg.save();
      await refreshConfig();
    }

    let types = (cfg.courseTypes || []).map((ct, idx) => ({
      id: ct.value,          // use value as stable id (slug)
      name: ct.value,
      label: ct.label,
      isActive: ct.isActive !== false,
      sortOrder: idx,
      usageCount: usage[ct.value] || 0,
    }));

    if (activeOnly) {
      types = types.filter(t => t.isActive);
    }

    if (req.query.search) {
      const q = String(req.query.search).toLowerCase();
      types = types.filter(t => t.name.toLowerCase().includes(q));
    }

    sendSuccess(res, types, 200);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/course-types/active — active types only (for dropdowns)
// ─────────────────────────────────────────────────────────────────
router.get('/active', requireAuth, async (req, res, next) => {
  try {
    const cfg = await loadConfig();
    const usage = await getUsageCounts();

    // Auto-sync missing course types from database (usage) into SystemConfig
    let configModified = false;
    const configuredNames = new Set((cfg.courseTypes || []).map(t => t.value.trim().toLowerCase()));

    Object.keys(usage).forEach(usedName => {
      const trimmed = usedName.trim();
      if (trimmed && !configuredNames.has(trimmed.toLowerCase())) {
        cfg.courseTypes.push({ value: trimmed, label: trimmed, isActive: true });
        configuredNames.add(trimmed.toLowerCase());
        configModified = true;
      }
    });

    if (configModified) {
      await cfg.save();
      await refreshConfig();
    }

    const types = (cfg.courseTypes || [])
      .filter(ct => ct.isActive !== false)
      .map((ct, idx) => ({ id: ct.value, name: ct.value, label: ct.label, sortOrder: idx }));
    sendSuccess(res, types, 200);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/course-types  — create (admin)
// ─────────────────────────────────────────────────────────────────
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const name = normalizeName(req.body.name);
    const label = normalizeName(req.body.label) || name;

    if (!name) return sendError(res, 'Course type name is required.', 400);

    const cfg = await loadConfig();
    const existing = (cfg.courseTypes || []).find(
      ct => ct.value.trim().toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      return sendError(res, `Course type "${existing.value}" already exists.`, 409);
    }

    cfg.courseTypes.push({ value: name, label, isActive: true });
    await cfg.save();
    await refreshConfig();

    logger.info('Course type created', { name, adminId: req.user.id });
    const usage = await getUsageCounts();
    const newType = { id: name, name, label, isActive: true, sortOrder: cfg.courseTypes.length - 1, usageCount: 0 };
    sendSuccess(res, newType, 201);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// PUT /api/course-types/:name  — edit name, label, isActive (admin)
// ─────────────────────────────────────────────────────────────────
router.put('/:name', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const oldName = decodeURIComponent(req.params.name).trim();
    const newName = req.body.name !== undefined ? normalizeName(req.body.name) : null;
    const newLabel = req.body.label !== undefined ? normalizeName(req.body.label) : null;
    const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : null;

    const cfg = await loadConfig();
    const idx = (cfg.courseTypes || []).findIndex(
      ct => ct.value.trim().toLowerCase() === oldName.toLowerCase()
    );
    if (idx === -1) return sendNotFound(res, `Course type "${oldName}" not found.`);

    // Check new name uniqueness (if renaming)
    if (newName && newName.toLowerCase() !== oldName.toLowerCase()) {
      const clash = (cfg.courseTypes || []).find(
        (ct, i) => i !== idx && ct.value.trim().toLowerCase() === newName.toLowerCase()
      );
      if (clash) return sendError(res, `Course type "${clash.value}" already exists.`, 409);
    }

    const ct = cfg.courseTypes[idx];
    const finalName = newName || ct.value;
    const finalLabel = newLabel || ct.label;

    // If renaming, update all existing courses and workloads that use this type
    if (newName && newName !== ct.value) {
      const db = mongoose.connection.db;
      await db.collection('courses').updateMany({ courseType: ct.value }, { $set: { courseType: finalName } });
      await db.collection('workloads').updateMany({ courseType: ct.value }, { $set: { courseType: finalName } });
      logger.info('Renamed courseType in courses+workloads', { from: ct.value, to: finalName, adminId: req.user.id });
    }

    cfg.courseTypes[idx] = { value: finalName, label: finalLabel, isActive: isActive !== null ? isActive : ct.isActive };
    cfg.markModified('courseTypes');
    await cfg.save();
    await refreshConfig();

    logger.info('Course type updated', { oldName, finalName, adminId: req.user.id });
    const usage = await getUsageCounts();
    sendSuccess(res, {
      id: finalName, name: finalName, label: finalLabel,
      isActive: cfg.courseTypes[idx].isActive, sortOrder: idx,
      usageCount: usage[finalName] || 0
    }, 200);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/course-types/:name  — delete if unused (admin)
// ─────────────────────────────────────────────────────────────────
router.delete('/:name', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const name = decodeURIComponent(req.params.name).trim();
    const cfg = await loadConfig();
    const idx = (cfg.courseTypes || []).findIndex(
      ct => ct.value.trim().toLowerCase() === name.toLowerCase()
    );
    if (idx === -1) return sendNotFound(res, `Course type "${name}" not found.`);

    // Check usage
    const usage = await getUsageCounts();
    const usageCount = usage[cfg.courseTypes[idx].value] || 0;
    if (usageCount > 0) {
      return sendError(res, `Cannot delete "${name}" — it is used by ${usageCount} course(s). Deactivate it instead.`, 409);
    }

    cfg.courseTypes.splice(idx, 1);
    cfg.markModified('courseTypes');
    await cfg.save();
    await refreshConfig();

    logger.info('Course type deleted', { name, adminId: req.user.id });
    sendSuccess(res, { message: `Course type "${name}" deleted successfully.` }, 200);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
