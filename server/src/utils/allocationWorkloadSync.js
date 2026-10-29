'use strict';

/**
 * utils/allocationWorkloadSync.js
 *
 * Bi-directional synchronization between CourseAllocation and Workload collections.
 * Ensures every assignment made in CourseAllocation (R1 Main Faculty, R2/R3/R4 TAs/Supporting Faculty)
 * is accurately and immediately reflected in the Workload collection and Workload page.
 */

const Workload = require('../models/Workload');
const CourseAllocation = require('../models/CourseAllocation');
const Faculty = require('../models/Faculty');
const Course = require('../models/Course');
const { isTADesignation } = require('./designationUtils');
const logger = require('./logger');

const normalizeYear = (y) => {
  if (!y) return '';
  const s = String(y).trim().toUpperCase();
  if (s === '1') return 'I';
  if (s === '2') return 'II';
  if (s === '3') return 'III';
  if (s === '4') return 'IV';
  return s;
};

/**
 * Synchronize a single CourseAllocation document into corresponding Workload entries.
 * Handles R1 (Main Faculty) and R2, R3, R4 (TA / Supporting Faculty) slots.
 * Supports optional context { courseMap, facultyMap } for high-speed batch reconciliation.
 */
const syncAllocationDocToWorkload = async (allocDoc, session = null, context = null) => {
  if (!allocDoc || !allocDoc.courseId) return;

  const numericCourseId = Number(allocDoc.courseId);
  const normalizedYearStr = normalizeYear(allocDoc.year);
  const sectionStr = String(allocDoc.section || '').trim();
  const semesterStr = String(allocDoc.semester || 'ODD').toUpperCase();
  const academicYearStr = String(allocDoc.academicYear || '').trim();

  if (!numericCourseId || !normalizedYearStr || !sectionStr || !academicYearStr) {
    return;
  }

  // Look up course details if available for courseType, L/T/P, etc.
  let course = null;
  if (context && context.courseMap) {
    course = context.courseMap.get(numericCourseId);
  } else {
    const courseQuery = Course.findOne({ courseId: numericCourseId }).lean();
    if (session) courseQuery.session(session);
    course = await courseQuery.exec();
  }

  const subjectCode = allocDoc.subjectCode || course?.subjectCode || '';
  const subjectName = allocDoc.subjectName || course?.subjectName || '';
  const shortName = allocDoc.shortName || course?.shortName || '';
  const program = allocDoc.program || course?.program || 'B.Tech';
  const courseType = course?.courseType || 'Other';
  const courseTypeKey = String(courseType).toLowerCase() === 'de' ? 'DE' : 'OTHER';
  const fixedL = Number(allocDoc.fixedL ?? course?.L ?? 0);
  const fixedT = Number(allocDoc.fixedT ?? course?.T ?? 0);
  const fixedP = Number(allocDoc.fixedP ?? course?.P ?? 0);
  const C = Number(allocDoc.C ?? course?.C ?? 0);

  const lSlots = Array.isArray(allocDoc.lectureSlots) && allocDoc.lectureSlots.length > 0
    ? allocDoc.lectureSlots
    : allocDoc.lectureSlot?.empId ? [allocDoc.lectureSlot] : [];
  const tSlots = Array.isArray(allocDoc.tutorialSlots) ? allocDoc.tutorialSlots : [];
  const pSlots = Array.isArray(allocDoc.practicalSlots) ? allocDoc.practicalSlots : [];

  // Slot definitions to sync:
  // slotIdx 0 = R1 (Main Faculty)
  // slotIdx 1 = R2 (TA / Supporting Faculty, allocationRow 1)
  // slotIdx 2 = R3 (TA / Supporting Faculty, allocationRow 2)
  // slotIdx 3 = R4 (TA / Supporting Faculty, allocationRow 3)
  const slotConfigs = [
    {
      slotIdx: 0,
      isMain: true,
      allocationRow: null,
      empId: lSlots[0]?.empId ? String(lSlots[0].empId).trim() : null,
      getRole: () => 'Main Faculty',
      getHours: () => ({
        hoursL: lSlots[0]?.hours !== undefined && lSlots[0]?.hours !== null ? Number(lSlots[0].hours) : fixedL,
        hoursT: (tSlots[0]?.empId && String(tSlots[0].empId).trim() !== String(lSlots[0]?.empId || '').trim())
          ? 0
          : (tSlots[0]?.hours !== undefined && tSlots[0]?.hours !== null ? Number(tSlots[0].hours) : fixedT),
        hoursP: (pSlots[0]?.empId && String(pSlots[0].empId).trim() !== String(lSlots[0]?.empId || '').trim())
          ? 0
          : (pSlots[0]?.hours !== undefined && pSlots[0]?.hours !== null ? Number(pSlots[0].hours) : fixedP),
      }),
    },
    ...[1, 2, 3].map((idx) => {
      const tSlot = tSlots[idx];
      const pSlot = pSlots[idx];
      const slotEmp = (tSlot?.empId ? String(tSlot.empId).trim() : null) || (pSlot?.empId ? String(pSlot.empId).trim() : null);

      return {
        slotIdx: idx,
        isMain: false,
        allocationRow: idx,
        empId: slotEmp,
        getRole: (designation, facRole) => {
          const isTA = isTADesignation(designation) || facRole === 'TA';
          return isTA ? 'TA' : 'Supporting Faculty';
        },
        getHours: () => ({
          hoursL: 0,
          hoursT: tSlot?.empId ? (tSlot.hours !== undefined && tSlot.hours !== null ? Number(tSlot.hours) : fixedT) : 0,
          hoursP: pSlot?.empId ? (pSlot.hours !== undefined && pSlot.hours !== null ? Number(pSlot.hours) : fixedP) : 0,
        }),
      };
    }),
  ];

  for (const cfg of slotConfigs) {
    const slotEmpId = cfg.empId;

    // Slot search criteria
    const slotBaseFilter = {
      courseId: numericCourseId,
      year: normalizedYearStr,
      section: sectionStr,
      semester: semesterStr,
      academicYear: academicYearStr,
    };

    const slotQueryFilter = cfg.isMain
      ? { ...slotBaseFilter, facultyRole: 'Main Faculty' }
      : { ...slotBaseFilter, allocationRow: cfg.allocationRow };

    if (slotEmpId) {
      // Find faculty details
      let fac = null;
      if (context && context.facultyMap) {
        fac = context.facultyMap.get(slotEmpId);
      } else {
        const facultyQuery = Faculty.findOne({ empId: slotEmpId }).lean();
        if (session) facultyQuery.session(session);
        fac = await facultyQuery.exec();
      }

      const slotObj = cfg.slotIdx === 0
        ? lSlots[0]
        : (tSlots[cfg.slotIdx]?.empId ? tSlots[cfg.slotIdx] : pSlots[cfg.slotIdx]);

      const empName = fac?.name || slotObj?.empName || slotEmpId;
      const designation = fac?.designation || slotObj?.designation || '—';
      const department = fac?.department || 'CSE';
      const mobile = fac?.mobile || '';
      const facultyRole = cfg.getRole(designation, fac?.role);
      const hours = cfg.getHours();

      const updateData = {
        empId: slotEmpId,
        empName,
        designation,
        department,
        mobile,
        courseId: numericCourseId,
        courseType,
        courseTypeKey,
        subjectCode,
        subjectName,
        shortName,
        program,
        year: normalizedYearStr,
        section: sectionStr,
        fixedL,
        fixedT,
        fixedP,
        C,
        manualL: hours.hoursL,
        manualT: hours.hoursT,
        manualP: hours.hoursP,
        facultyRole,
        allocationRow: cfg.allocationRow,
        semester: semesterStr,
        academicYear: academicYearStr,
        academicYearSemesterId: allocDoc.academicYearSemesterId || null,
        allocationStatus: 'ALLOCATED',
        isDeleted: false,
        deletedAt: null,
      };

      // 1. Check if there's an existing workload for this faculty member on this course + section + semester
      const empWlQuery = Workload.findOne({
        empId: slotEmpId,
        courseId: numericCourseId,
        year: normalizedYearStr,
        section: sectionStr,
        semester: semesterStr,
        ...(academicYearStr ? { academicYear: academicYearStr } : {}),
      });
      if (session) empWlQuery.session(session);
      const existingEmpWl = await empWlQuery.exec();

      if (existingEmpWl) {
        // Preserves admin's existing isVisible toggle state (never overwrites visibility on sync)
        await Workload.findByIdAndUpdate(
          existingEmpWl._id,
          { $set: updateData },
          { new: true, ...(session && { session }) }
        );
      } else {
        // 2. Check if a workload already exists for this specific slot (e.g. replacing prior faculty)
        const existingQuery = Workload.findOne(slotQueryFilter);
        if (session) existingQuery.session(session);
        const existingWl = await existingQuery.exec();

        if (existingWl) {
          // Preserves admin's existing isVisible toggle state (never overwrites visibility on sync)
          await Workload.findByIdAndUpdate(
            existingWl._id,
            { $set: updateData },
            { new: true, ...(session && { session }) }
          );
        } else {
          // 3. Create new workload (inherits visibility of period if visible, otherwise false)
          const periodHasVisible = await Workload.exists({
            academicYear: academicYearStr,
            semester: semesterStr,
            isDeleted: false,
            isVisible: true,
          });
          const newDoc = new Workload({
            ...updateData,
            isVisible: Boolean(periodHasVisible),
          });
          await newDoc.save({ ...(session && { session }) });
        }
      }
    } else {
      // Slot is empty. If there is an existing active workload for this slot, soft delete / cancel it.
      const existingQuery = Workload.findOne({ ...slotQueryFilter, isDeleted: false });
      if (session) existingQuery.session(session);
      const existingWl = await existingQuery.exec();

      if (existingWl) {
        await Workload.findByIdAndUpdate(
          existingWl._id,
          {
            $set: {
              isDeleted: true,
              deletedAt: new Date(),
              allocationStatus: 'UNALLOCATED',
            },
          },
          { ...(session && { session }) }
        );
      }
    }
  }
};

/**
 * Remove/soft-delete all workloads corresponding to a deleted allocation.
 */
const removeWorkloadsForAllocation = async ({ courseId, year, section, semester, academicYear }, session = null) => {
  const numericCourseId = Number(courseId);
  const normalizedYearStr = normalizeYear(year);
  const sectionStr = String(section || '').trim();
  const semesterStr = String(semester || 'ODD').toUpperCase();

  const filter = {
    courseId: numericCourseId,
    year: normalizedYearStr,
    section: sectionStr,
    ...(semesterStr ? { semester: semesterStr } : {}),
    ...(academicYear ? { academicYear: String(academicYear).trim() } : {}),
  };

  await Workload.updateMany(
    filter,
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        allocationStatus: 'UNALLOCATED',
      },
    },
    { ...(session && { session }) }
  );
};

/**
 * Reconcile and synchronize all CourseAllocations into Workload collection.
 * Uses cached course & faculty maps and batch processing for maximum speed.
 * Safe, idempotent, preserves all valid data, and backfills missing assignments.
 */
let lastReconcileTime = 0;
const RECONCILE_THROTTLE_MS = 10000; // Run at most once every 10s per process

const reconcileAllAllocationsToWorkload = async ({ semester = null, academicYear = null } = {}, force = false) => {
  const now = Date.now();
  if (!force && now - lastReconcileTime < RECONCILE_THROTTLE_MS) {
    return { skipped: true, reason: 'throttled' };
  }
  lastReconcileTime = now;

  try {
    const filter = {};
    if (semester) filter.semester = String(semester).toUpperCase();
    if (academicYear) filter.academicYear = String(academicYear).trim();

    const [allocs, allCourses, allFaculty] = await Promise.all([
      CourseAllocation.find(filter).lean(),
      Course.find().lean(),
      Faculty.find().lean(),
    ]);

    const courseMap = new Map();
    for (const c of allCourses) {
      if (c.courseId) courseMap.set(Number(c.courseId), c);
      if (c.id) courseMap.set(Number(c.id), c);
    }

    const facultyMap = new Map();
    for (const f of allFaculty) {
      if (f.empId) facultyMap.set(String(f.empId).trim(), f);
    }

    const context = { courseMap, facultyMap };
    let syncedCount = 0;

    // Process in concurrent chunks of 15
    const CHUNK_SIZE = 15;
    for (let i = 0; i < allocs.length; i += CHUNK_SIZE) {
      const chunk = allocs.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (alloc) => {
          try {
            await syncAllocationDocToWorkload(alloc, null, context);
            syncedCount++;
          } catch (err) {
            logger.error('Error syncing allocation to workload:', {
              allocationId: alloc._id,
              error: err.message,
            });
          }
        })
      );
    }

    logger.info('Allocation to Workload reconciliation completed', {
      totalAllocations: allocs.length,
      syncedCount,
      semester,
      academicYear,
    });

    return { success: true, totalAllocations: allocs.length, syncedCount };
  } catch (err) {
    logger.error('Error reconciling allocations to workload:', { error: err.message });
    return { success: false, error: err.message };
  }
};

module.exports = {
  syncAllocationDocToWorkload,
  removeWorkloadsForAllocation,
  reconcileAllAllocationsToWorkload,
  normalizeYear,
};
