/**
 * routes/allocations.js
 *
 * GET    /api/allocations                  — list all (admin)
 * GET    /api/allocations/course/:courseId — get all allocations for a course (admin)
 * POST   /api/allocations                  — upsert one allocation (admin)
 * DELETE /api/allocations/:id              — delete one (admin)
 * GET    /api/allocations/workload-sheets  — generate per-faculty workload sheets (admin)
 * GET    /api/allocations/export/csv       — CSV export (admin)
 */

'use strict';

const express          = require('express');
const CourseAllocation = require('../models/CourseAllocation');
const Course           = require('../models/Course');
const Faculty          = require('../models/Faculty');
const Setting          = require('../models/Setting');
const { parsePagination, buildMeta } = require('../utils/pagination');
const { logAuditEvent } = require('../utils/audit');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const logger           = require('../utils/logger');

const router = express.Router();

const sec = (n) => Array.from({ length: n }, (_, i) => String(i + 1));
const DEFAULT_SECTIONS = {
  I: sec(19), II: sec(22), III: sec(19), IV: sec(9), 'M.Tech': ['1', '2'],
};

// CRITICAL: Normalize year format (numeric or Roman numeral) to canonical form
// Maps: '1' -> 'I', '2' -> 'II', '3' -> 'III', '4' -> 'IV', 'M.Tech' -> 'M.Tech'
const normalizeYear = (year) => {
  const trimmed = String(year || '').trim().toUpperCase();
  if (trimmed === 'I' || trimmed === '1') return 'I';
  if (trimmed === 'II' || trimmed === '2') return 'II';
  if (trimmed === 'III' || trimmed === '3') return 'III';
  if (trimmed === 'IV' || trimmed === '4') return 'IV';
  if (trimmed === 'M.TECH') return 'M.Tech';
  return trimmed; // Return as-is if not recognized
};

const getSectionsConfig = async () => {
  const doc = await Setting.findOne({ key: 'sections_config' }).lean();
  if (!doc?.value) return DEFAULT_SECTIONS;
  try {
    const parsed = JSON.parse(doc.value);
    return { ...DEFAULT_SECTIONS, ...(parsed || {}) };
  } catch {
    return DEFAULT_SECTIONS;
  }
};

const hasDuplicateEmpId = (slots = []) => {
  const ids = slots.filter(s => s?.empId).map(s => String(s.empId).trim());
  return new Set(ids).size !== ids.length;
};

const isTADesignation = (designation = '') => {
  const value = String(designation || '').trim().toLowerCase();
  return value === 'ta' || value.includes('teaching assistant');
};

const emptySlot = () => ({ empId: '', empName: '', designation: '', hours: 0 });

const normalizeSlots = (slots = [], count = 0) => {
  const source = Array.isArray(slots) ? slots : [];
  return Array.from({ length: count }, (_, idx) => {
    const slot = source[idx] || {};
    return {
      empId: String(slot.empId || '').trim(),
      empName: String(slot.empName || '').trim(),
      designation: String(slot.designation || '').trim(),
      hours: slot.hours ?? 0,
    };
  });
};

// ── helper ─────────────────────────────────────────────────────────────────
const toClient = (doc) => ({
  id:             doc._id?.toString() || '',
  courseId:       Number(doc.courseId || 0),
  subjectCode:    String(doc.subjectCode || '').trim(),
  subjectName:    String(doc.subjectName || '').trim(),
  shortName:      String(doc.shortName || '').trim(),
  program:        String(doc.program || '').trim() || 'N/A',
  year:           String(doc.year || '').trim() || 'I',
  section:        String(doc.section || '').trim() || '1',
  fixedL:         Number(doc.fixedL || 0),
  fixedT:         Number(doc.fixedT || 0),
  fixedP:         Number(doc.fixedP || 0),
  C:              Number(doc.C || 0),
  lectureSlot:    normalizeSlots([doc.lectureSlot], 1)[0] || emptySlot(),
  lectureSlots:   normalizeSlots(doc.lectureSlots, 4),
  tutorialSlots:  normalizeSlots(doc.tutorialSlots, 4),
  practicalSlots: normalizeSlots(doc.practicalSlots, 4),
  createdBy:      String(doc.createdBy || '').trim(),
  createdAt:      doc.createdAt?.toISOString() || null,
  updatedAt:      doc.updatedAt?.toISOString() || null,
});

// GET /api/allocations
// CRITICAL: Returns ALL allocation records matching the filter.
// Uses find() (NOT findOne()) to ensure complete data.
// Supports filtering by courseId, year, and/or section.
// If no filters provided, returns ALL allocations (paginated).
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    // Disable caching to prevent 304 Not Modified responses
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    
    // MANDATORY: Apply all provided filters (trim for consistency)
    if (req.query.courseId) filter.courseId = Number(req.query.courseId);
    // CRITICAL: Normalize year to canonical format (I/II/III/IV or M.Tech) for consistent filtering
    if (req.query.year) filter.year = normalizeYear(req.query.year);
    if (req.query.section) filter.section = String(req.query.section).trim();
    
    // CRITICAL: Always use find() — NEVER findOne()
    // This ensures ALL matching records are returned, not just the first one
    const [total, docs] = await Promise.all([
      CourseAllocation.countDocuments(filter),
      CourseAllocation.find(filter)
        .select('courseId subjectCode subjectName shortName program year section fixedL fixedT fixedP C lectureSlot lectureSlots tutorialSlots practicalSlots createdBy createdAt updatedAt')
        .sort({ courseId: 1, year: 1, section: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);
    
    // Logging for data integrity monitoring
    const docsWithData = docs.filter(d => 
      (d.lectureSlots?.some(s => s?.empId)) || 
      (d.lectureSlot?.empId) ||
      (d.tutorialSlots?.some(s => s?.empId)) || 
      (d.practicalSlots?.some(s => s?.empId))
    );
    
    // Log allocation retrieval
    logger.info('Allocations listed', {
      userId: req.user.id,
      filter: JSON.stringify(filter),
      total,
      returned: docs.length,
      withAssignments: docsWithData.length,
      page,
      limit
    });
    
    res.json({ 
      success: true, 
      data: docs.map(toClient), 
      meta: buildMeta({ total, page, limit }),
      stats: { 
        totalRecords: total,
        returnedRecords: docs.length,
        recordsWithAssignments: docsWithData.length,
        filter: Object.keys(filter).length > 0 ? filter : { note: 'NO_FILTERS_APPLIED_RETURNS_ALL' }
      }
    });
  } catch (err) { 
    logger.error('Error listing allocations', { error: err.message, userId: req.user.id });
    next(err); 
  }
});

// GET /api/allocations/workload-sheets  — per-faculty aggregated view
router.get('/workload-sheets', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    // Disable caching to prevent 304 Not Modified responses
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const docs = await CourseAllocation.find().lean();

    // Build a map: empId → { faculty info, rows[] }
    const map = {};

    const addRow = (empId, empName, designation, entry) => {
      if (!empId) return;
      if (!map[empId]) map[empId] = { empId, empName, designation, rows: [] };
      map[empId].rows.push(entry);
    };

    docs.forEach(d => {
      const base = {
        courseId:    d.courseId,
        subjectCode: d.subjectCode,
        subjectName: d.subjectName,
        year:        d.year,
        section:     d.section,
      };

      // Lecture — use lectureSlots array, fall back to singular lectureSlot
      const lSlots = d.lectureSlots && d.lectureSlots.length > 0
        ? d.lectureSlots
        : d.lectureSlot?.empId ? [d.lectureSlot] : [];
      lSlots.filter(s => s.empId).forEach((s, i) => {
        addRow(s.empId, s.empName, s.designation,
          { ...base, type: 'L', slot: i + 1, hours: s.hours || d.fixedL });
      });

      // Tutorial slots
      (d.tutorialSlots || []).filter(s => s.empId).forEach(s => {
        addRow(s.empId, s.empName, s.designation,
          { ...base, type: 'T', hours: s.hours || d.fixedT });
      });

      // Practical slots
      (d.practicalSlots || []).filter(s => s.empId).forEach(s => {
        addRow(s.empId, s.empName, s.designation,
          { ...base, type: 'P', hours: s.hours || d.fixedP });
      });
    });

    // Add totals
    const sheets = Object.values(map).map(f => ({
      ...f,
      totalHours: f.rows.reduce((sum, r) => sum + (r.hours || 0), 0),
    })).sort((a, b) => a.empId.localeCompare(b.empId));

    res.json({ success: true, data: sheets });
  } catch (err) { next(err); }
});

// GET /api/allocations/export/csv
router.get('/export/csv', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    // Disable caching for dynamic data
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const docs = await CourseAllocation.find().sort({ courseId: 1, year: 1, section: 1 }).lean();

    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Course ID','Subject Code','Subject Name','Year','Section',
      'Type','Slot','Emp ID','Faculty Name','Designation','Hours'];
    const rows = [];

    docs.forEach(d => {
      const pushRow = (type, slotIdx, slot) => {
        if (!slot?.empId) return;
        rows.push([
          d.courseId, d.subjectCode, d.subjectName, d.year, d.section,
          type, slotIdx + 1, slot.empId, slot.empName, slot.designation, slot.hours,
        ].map(esc).join(','));
      };

      const lSlots = d.lectureSlots && d.lectureSlots.length > 0
        ? d.lectureSlots
        : d.lectureSlot?.empId ? [d.lectureSlot] : [];
      lSlots.forEach((s, i) => pushRow('L', i, s));
      (d.tutorialSlots  || []).forEach((s, i) => pushRow('T', i, s));
      (d.practicalSlots || []).forEach((s, i) => pushRow('P', i, s));
    });

    const csv = [headers.map(esc).join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="course_allocations.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

// POST /api/allocations  — upsert (create or update by courseId+year+section)
// ENHANCED: Implements auto-fill and mirror logic for allocation rules
// R1 Auto-Fill: When L.R1 is set, automatically populate T.R1 and P.R1
// R2-R4 Mirror: When T.R2/R3/R4 is set, mirror to P.R2/R3/R4 and vice versa
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const {
      courseId, year: rawYear, section,
      lectureSlot, lectureSlots, tutorialSlots, practicalSlots,
    } = req.body;

    // CRITICAL: Normalize year to canonical format (I/II/III/IV or M.Tech)
    const year = normalizeYear(rawYear);

    const allSlots = [
      ...(Array.isArray(lectureSlots) ? lectureSlots : []),
      ...(Array.isArray(tutorialSlots) ? tutorialSlots : []),
      ...(Array.isArray(practicalSlots) ? practicalSlots : []),
      ...(lectureSlot ? [lectureSlot] : []),
    ];
    const badHours = allSlots.some((slot) => slot && slot.hours !== undefined && (!Number.isFinite(Number(slot.hours)) || Number(slot.hours) < 0 || Number(slot.hours) > 30));
    if (badHours) {
      return res.status(400).json({ success: false, message: 'Slot hours must be between 0 and 30.' });
    }

    if (!courseId || !year || !section)
      return res.status(400).json({ success: false, message: 'courseId, year, section required.' });

    const sectionCfg = await getSectionsConfig();
    if (sectionCfg[year] && !sectionCfg[year].includes(section)) {
      return res.status(400).json({ success: false, message: `Invalid section '${section}' for year '${year}'.` });
    }

    const course = await Course.findOne({ courseId: Number(courseId) }).lean();
    if (!course)
      return res.status(404).json({ success: false, message: 'Course not found.' });

    // Validate/enrich each empId in the slots
    const enrichSlot = async (slot) => {
      if (!slot?.empId) return slot;
      const f = await Faculty.findOne({ empId: slot.empId.trim() }).lean();
      if (!f) {
        const err = new Error(`Faculty not found for empId '${slot.empId}'.`);
        err.status = 404;
        throw err;
      }
      return { empId: f.empId, empName: f.name, designation: f.designation, hours: slot.hours ?? 0 };
    };

    // Support both lectureSlots (array) and legacy lectureSlot (single).
    // Keep fixed row shape so R2/R3/R4 references remain stable.
    const rawLSlots = lectureSlots && lectureSlots.length > 0
      ? normalizeSlots(lectureSlots, 1)
      : lectureSlot?.empId ? normalizeSlots([lectureSlot], 1) : normalizeSlots([], 1);
    let rawTutorialSlots = normalizeSlots(tutorialSlots, 4);
    let rawPracticalSlots = normalizeSlots(practicalSlots, 4);

    if (hasDuplicateEmpId(rawLSlots) || hasDuplicateEmpId(rawTutorialSlots) || hasDuplicateEmpId(rawPracticalSlots)) {
      return res.status(409).json({ success: false, message: 'Duplicate faculty slot detected in allocation data.' });
    }

    const enrichedLSlots = await Promise.all(rawLSlots.map(enrichSlot));
    const enrichedLecture = enrichedLSlots[0] || emptySlot();

    let enrichedTutorials = await Promise.all(rawTutorialSlots.map(enrichSlot));
    let enrichedPracticals = await Promise.all(rawPracticalSlots.map(enrichSlot));

    const existing = await CourseAllocation.findOne({ courseId: Number(courseId), year, section }).lean();

    // RULE 1: Validate R1 must be MAIN faculty (not TA) for all types
    const lectureHasTa = enrichedLSlots.some((slot) => slot?.empId && isTADesignation(slot?.designation));
    if (lectureHasTa) {
      return res.status(400).json({
        success: false,
        message: 'R1 (Main Faculty slot) cannot be assigned to TA. R1 is reserved for Main Faculty only.',
      });
    }

    // Validate R1 in T and P must not be TA designation
    if (enrichedTutorials[0]?.empId && isTADesignation(enrichedTutorials[0]?.designation)) {
      return res.status(400).json({
        success: false,
        message: 'Tutorial R1 must be Main Faculty, not TA.',
      });
    }

    if (enrichedPracticals[0]?.empId && isTADesignation(enrichedPracticals[0]?.designation)) {
      return res.status(400).json({
        success: false,
        message: 'Practical R1 must be Main Faculty, not TA.',
      });
    }

    // ENHANCEMENT 1: AUTO-FILL - If L.R1 is set, auto-populate T.R1 and P.R1
    if (enrichedLSlots[0]?.empId) {
      const mainFacultySlot = enrichedLSlots[0];
      enrichedTutorials[0] = mainFacultySlot;
      enrichedPracticals[0] = mainFacultySlot;
      console.log('✅ Auto-fill: L.R1 copied to T.R1 and P.R1', { empId: mainFacultySlot.empId, empName: mainFacultySlot.empName });
    }

    // TA assignment rules:
    // 1) TA can only be placed in R2/R3/R4 (row index 1..3) of Tutorial/Practical.
    // 2) Same TA cannot appear multiple times for the same subject+section.
    // 3) If a TA already exists in a TA row position, another faculty cannot replace it directly.
    const taEmpIds = [];
    const validateTaRules = (slots, type, existingSlots = []) => {
      slots.forEach((slot, idx) => {
        const empId = String(slot?.empId || '').trim();
        if (!empId) return;

        const existingEmpId = String(existingSlots[idx]?.empId || '').trim();
        const existingIsTa = !!existingEmpId && isTADesignation(existingSlots[idx]?.designation);
        if (existingIsTa && existingEmpId !== empId) {
          const rowNo = idx + 1;
          const err = new Error(`TA already assigned in ${type} row R${rowNo}. Clear the row first before assigning another faculty.`);
          err.status = 409;
          throw err;
        }

        if (!isTADesignation(slot?.designation)) return;

        const inAllowedRow = idx >= 1 && idx <= 3;
        if (!inAllowedRow) {
          const err = new Error(`TA can only be assigned in ${type} rows R2, R3, or R4.`);
          err.status = 400;
          throw err;
        }

        taEmpIds.push(empId);
      });
    };

    validateTaRules(enrichedTutorials, 'Tutorial', existing?.tutorialSlots || []);
    validateTaRules(enrichedPracticals, 'Practical', existing?.practicalSlots || []);

    const duplicateTa = taEmpIds.find((empId, index) => taEmpIds.indexOf(empId) !== index);
    if (duplicateTa) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate TA assignment is not allowed for the same subject and section.',
      });
    }

    // ENHANCEMENT 2: MIRROR LOGIC - Sync T.R2-R4 with P.R2-R4 and vice versa
    // When T is set, copy to P (unless P is already different and has a TA)
    // When P is set, copy to T (unless T is already different and has a TA)
    for (let idx = 1; idx <= 3; idx++) {
      const tSlot = enrichedTutorials[idx];
      const pSlot = enrichedPracticals[idx];
      const tHasEmpId = !!tSlot?.empId;
      const pHasEmpId = !!pSlot?.empId;

      // If T is set and P is empty, mirror T to P
      if (tHasEmpId && !pHasEmpId) {
        enrichedPracticals[idx] = tSlot;
        console.log(`✅ Mirror: T.R${idx + 1} → P.R${idx + 1}`, { empId: tSlot.empId, empName: tSlot.empName });
      }
      // If P is set and T is empty, mirror P to T
      else if (pHasEmpId && !tHasEmpId) {
        enrichedTutorials[idx] = pSlot;
        console.log(`✅ Mirror: P.R${idx + 1} → T.R${idx + 1}`, { empId: pSlot.empId, empName: pSlot.empName });
      }
      // If both are set but different, and the requestor explicitly wants to override, allow it
      // (already validated above that we won't overwrite existing TA assignments without clearing first)
    }

    const doc = await CourseAllocation.findOneAndUpdate(
      { courseId: Number(courseId), year, section },
      {
        $set: {
          subjectCode:    course.subjectCode,
          subjectName:    course.subjectName,
          shortName:      course.shortName,
          program:        course.program,
          fixedL:         course.L,
          fixedT:         course.T,
          fixedP:         course.P,
          C:              course.C,
          lectureSlots:   enrichedLSlots,
          lectureSlot:    enrichedLecture,
          tutorialSlots:  enrichedTutorials,
          practicalSlots: enrichedPracticals,
          createdBy:      req.user?.id || '',
        },
      },
      { upsert: true, new: true }
    ).lean();

    await logAuditEvent({ req, action: 'allocation.upsert', entity: 'allocation', entityId: String(doc._id), metadata: { courseId: doc.courseId, year: doc.year, section: doc.section } });

    res.status(201).json({ success: true, data: toClient(doc) });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ success: false, message: err.message || 'Validation failed.' });
    }
    next(err);
  }
});

// DELETE /api/allocations/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const doc = await CourseAllocation.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Allocation not found.' });
    await logAuditEvent({ req, action: 'allocation.delete', entity: 'allocation', entityId: String(req.params.id), metadata: { courseId: doc.courseId, year: doc.year, section: doc.section } });
    res.json({ success: true, message: 'Allocation removed.' });
  } catch (err) { next(err); }
});

module.exports = router;
