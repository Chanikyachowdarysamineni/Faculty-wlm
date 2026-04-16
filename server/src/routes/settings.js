/**
 * routes/settings.js
 *
 * GET  /api/settings/form-status  — get form open/closed
 * PUT  /api/settings/form-status  — toggle (admin)
 * GET  /api/settings/edit-status  — get edit enabled/disabled
 * PUT  /api/settings/edit-status  — toggle (admin)
 */

'use strict';

const express  = require('express');
const { body, validationResult } = require('express-validator');
const Setting  = require('../models/Setting');
const Workload = require('../models/Workload');
const CourseAllocation = require('../models/CourseAllocation');
const { mongoose } = require('../db');
const { logAuditEvent } = require('../utils/audit');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_SECTIONS = {
  I: Array.from({ length: 19 }, (_, i) => String(i + 1)),
  II: Array.from({ length: 22 }, (_, i) => String(i + 1)),
  III: Array.from({ length: 19 }, (_, i) => String(i + 1)),
  IV: Array.from({ length: 9 }, (_, i) => String(i + 1)),
  'M.Tech': ['1', '2'],
};

const normalizeSections = (raw) => {
  const base = { ...DEFAULT_SECTIONS };
  if (!raw || typeof raw !== 'object') return base;
  Object.keys(base).forEach((year) => {
    const list = Array.isArray(raw[year]) ? raw[year] : base[year];
    const cleaned = Array.from(new Set(list.map(v => String(v).trim()).filter(Boolean)));
    base[year] = cleaned.length ? cleaned : base[year];
  });
  return base;
};

const getSectionsConfig = async () => {
  const doc = await Setting.findOne({ key: 'sections_config' }).lean();
  if (!doc?.value) return DEFAULT_SECTIONS;
  try {
    return normalizeSections(JSON.parse(doc.value));
  } catch {
    return DEFAULT_SECTIONS;
  }
};

const saveSectionsConfig = async (sections) => {
  const normalized = normalizeSections(sections);
  await Setting.findOneAndUpdate(
    { key: 'sections_config' },
    { value: JSON.stringify(normalized) },
    { upsert: true, new: true }
  );
  return normalized;
};

// GET /api/settings/form-status
router.get('/form-status', requireAuth, async (req, res, next) => {
  try {
    const doc = await Setting.findOne({ key: 'form_enabled' }).lean();
    res.json({ success: true, formEnabled: doc ? doc.value === 'true' : true });
  } catch (err) { next(err); }
});

// PUT /api/settings/form-status  (admin)
router.put(
  '/form-status',
  requireAuth, requireAdmin,
  [body('formEnabled').isBoolean().withMessage('formEnabled must be a boolean.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const { formEnabled } = req.body;
      await Setting.findOneAndUpdate(
        { key: 'form_enabled' },
        { value: String(formEnabled) },
        { upsert: true, new: true }
      );
      await logAuditEvent({ req, action: 'settings.form.toggle', entity: 'settings', entityId: 'form_enabled', metadata: { formEnabled } });
      res.json({ success: true, formEnabled: Boolean(formEnabled) });
    } catch (err) { next(err); }
  }
);

// GET /api/settings/sections
router.get('/sections', requireAuth, async (req, res, next) => {
  try {
    const sections = await getSectionsConfig();
    res.json({ success: true, data: sections });
  } catch (err) { next(err); }
});

// PUT /api/settings/sections  (admin) - replace full map
router.put('/sections', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const sections = await saveSectionsConfig(req.body?.sections);
    res.json({ success: true, data: sections });
  } catch (err) { next(err); }
});

// POST /api/settings/sections/:year  (admin) - add section
router.post('/sections/:year', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const year = String(req.params.year || '').trim();
    const section = String(req.body?.section || '').trim();
    if (!year || !section) {
      return res.status(400).json({ success: false, message: 'year and section are required.' });
    }
    const current = await getSectionsConfig();
    if (!current[year]) return res.status(400).json({ success: false, message: 'Invalid year.' });
    if (current[year].includes(section)) {
      return res.status(409).json({ success: false, message: 'Section already exists.' });
    }
    current[year].push(section);
    const sections = await saveSectionsConfig(current);
    await logAuditEvent({ req, action: 'settings.section.add', entity: 'settings.sections', entityId: year, metadata: { section } });
    res.status(201).json({ success: true, data: sections });
  } catch (err) { next(err); }
});

// PUT /api/settings/sections/:year/:section  (admin) - rename section
router.put('/sections/:year/:section', requireAuth, requireAdmin, async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const year = String(req.params.year || '').trim();
    const oldSection = String(req.params.section || '').trim();
    const newSection = String(req.body?.newSection || '').trim();
    if (!year || !oldSection || !newSection) {
      return res.status(400).json({ success: false, message: 'year, section and newSection are required.' });
    }
    const current = await getSectionsConfig();
    if (!current[year]) return res.status(400).json({ success: false, message: 'Invalid year.' });
    const idx = current[year].indexOf(oldSection);
    if (idx < 0) return res.status(404).json({ success: false, message: 'Section not found.' });
    if (current[year].includes(newSection) && newSection !== oldSection) {
      return res.status(409).json({ success: false, message: 'Section already exists.' });
    }
    session.startTransaction();
    current[year][idx] = newSection;
    await Workload.updateMany({ year, section: oldSection }, { $set: { section: newSection } }, { session });
    await CourseAllocation.updateMany({ year, section: oldSection }, { $set: { section: newSection } }, { session });
    const normalized = normalizeSections(current);
    await Setting.findOneAndUpdate(
      { key: 'sections_config' },
      { value: JSON.stringify(normalized) },
      { upsert: true, new: true, session }
    );
    await session.commitTransaction();
    await logAuditEvent({ req, action: 'settings.section.rename', entity: 'settings.sections', entityId: year, metadata: { oldSection, newSection } });
    const sections = normalized;
    res.json({ success: true, data: sections });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
});

// DELETE /api/settings/sections/:year/:section  (admin)
router.delete('/sections/:year/:section', requireAuth, requireAdmin, async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const year = String(req.params.year || '').trim();
    const section = String(req.params.section || '').trim();
    const current = await getSectionsConfig();
    if (!current[year]) return res.status(400).json({ success: false, message: 'Invalid year.' });
    current[year] = current[year].filter(s => s !== section);
    if (current[year].length === 0) {
      return res.status(400).json({ success: false, message: 'At least one section must remain for a year.' });
    }
    session.startTransaction();
    await Workload.deleteMany({ year, section }, { session });
    await CourseAllocation.deleteMany({ year, section }, { session });
    const normalized = normalizeSections(current);
    await Setting.findOneAndUpdate(
      { key: 'sections_config' },
      { value: JSON.stringify(normalized) },
      { upsert: true, new: true, session }
    );
    await session.commitTransaction();
    await logAuditEvent({ req, action: 'settings.section.delete', entity: 'settings.sections', entityId: year, metadata: { section } });
    const sections = normalized;
    res.json({ success: true, data: sections });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
});

// GET /api/settings/edit-status
router.get('/edit-status', requireAuth, async (req, res, next) => {
  try {
    const doc = await Setting.findOne({ key: 'edit_enabled' }).lean();
    res.json({ success: true, editEnabled: doc ? doc.value === 'true' : true });
  } catch (err) { next(err); }
});

// PUT /api/settings/edit-status  (admin)
router.put(
  '/edit-status',
  requireAuth, requireAdmin,
  [body('editEnabled').isBoolean().withMessage('editEnabled must be a boolean.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const { editEnabled } = req.body;
      await Setting.findOneAndUpdate(
        { key: 'edit_enabled' },
        { value: String(editEnabled) },
        { upsert: true, new: true }
      );
      await logAuditEvent({ req, action: 'settings.edit.toggle', entity: 'settings', entityId: 'edit_enabled', metadata: { editEnabled } });
      res.json({ success: true, editEnabled: Boolean(editEnabled) });
    } catch (err) { next(err); }
  }
);

module.exports = router;

