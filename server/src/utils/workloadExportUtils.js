'use strict';

/**
 * utils/workloadExportUtils.js
 *
 * Provides aggregation and formatting logic for Course-wise Main Faculty Workload Export.
 * - Extracts Main Faculty allocations across Workload and CourseAllocation collections
 * - Deduplicates and groups by Course Code, Year, and Section
 * - Combines multiple Main Faculty into a single cell
 * - Excludes Supporting Faculty and TAs (R2, R3, R4)
 * - Generates professionally styled Excel (.xlsx) files
 */

const ExcelJS = require('exceljs');
const Workload = require('../models/Workload');
const CourseAllocation = require('../models/CourseAllocation');
const Faculty = require('../models/Faculty');
const Course = require('../models/Course');
const { normalizeYear } = require('./courseUtils');
const { isTADesignation } = require('./designationUtils');
const { generateCSV } = require('./exportUtils');

const ROMAN_ORDER = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, '1': 1, '2': 2, '3': 3, '4': 4 };

/**
 * Fetch and aggregate Course-wise Main Faculty Workload data.
 *
 * @param {Object} filterOptions - { academicYear, semester, program }
 * @returns {Promise<Array<{ courseCode, courseName, mainFacultyAssigned, year, section, program }>>}
 */
const getCourseMainFacultyWorkloadData = async (filterOptions = {}) => {
  const { academicYear, semester, program } = filterOptions;

  const wlFilter = {
    facultyRole: 'Main Faculty',
    allocationStatus: { $nin: ['CANCELLED', 'UNALLOCATED'] },
    isDeleted: { $ne: true },
    empId: { $exists: true, $ne: '' }
  };

  const allocFilter = {
    isDeleted: { $ne: true }
  };

  if (academicYear && String(academicYear).trim().toUpperCase() !== 'ALL') {
    const yrStr = String(academicYear).trim();
    wlFilter.academicYear = yrStr;
    allocFilter.academicYear = yrStr;
  }

  if (semester && String(semester).trim().toUpperCase() !== 'ALL') {
    const semStr = String(semester).trim().toUpperCase();
    wlFilter.semester = semStr;
    allocFilter.semester = semStr;
  }

  if (program && String(program).trim().toUpperCase() !== 'ALL') {
    const progStr = String(program).trim();
    wlFilter.program = progStr;
    allocFilter.program = progStr;
  }

  const [workloadDocs, allocDocs] = await Promise.all([
    Workload.find(wlFilter).lean(),
    CourseAllocation.find(allocFilter).lean()
  ]);

  // Collect missing faculty names for lookup
  const missingEmpIds = new Set();
  workloadDocs.forEach(w => {
    if (!w.empName && w.empId) missingEmpIds.add(String(w.empId).trim());
  });
  allocDocs.forEach(a => {
    const lSlots = Array.isArray(a.lectureSlots) && a.lectureSlots.length > 0
      ? a.lectureSlots
      : (a.lectureSlot?.empId ? [a.lectureSlot] : []);
    lSlots.forEach(s => {
      if (s?.empId && !s?.empName) missingEmpIds.add(String(s.empId).trim());
    });
  });

  const facultyMap = new Map();
  if (missingEmpIds.size > 0) {
    const facDocs = await Faculty.find({ empId: { $in: Array.from(missingEmpIds) } }).select('empId name').lean();
    facDocs.forEach(f => facultyMap.set(String(f.empId).trim(), f.name));
  }

  // Key: courseCode____year____section
  const rowsMap = new Map();
  const getRowKey = (code, yr, sec) => `${String(code || '').trim()}____${normalizeYear(yr)}____${String(sec || '').trim()}`;

  // 1. Process Workload records (only Main Faculty)
  for (const w of workloadDocs) {
    const code = String(w.subjectCode || '').trim();
    const sec = String(w.section || '').trim();
    const yr = normalizeYear(w.year);
    if (!code || !sec || !yr) continue;

    const key = getRowKey(code, yr, sec);
    const facName = String(w.empName || facultyMap.get(String(w.empId).trim()) || w.empId || '').trim();

    if (!rowsMap.has(key)) {
      rowsMap.set(key, {
        courseCode: code,
        courseName: String(w.subjectName || '').trim(),
        program: String(w.program || 'B.Tech').trim(),
        year: yr,
        section: sec,
        facultySet: new Set()
      });
    }
    const item = rowsMap.get(key);
    if (facName) item.facultySet.add(facName);
    if (!item.courseName && w.subjectName) item.courseName = String(w.subjectName).trim();
    if (!item.program && w.program) item.program = String(w.program).trim();
  }

  // 2. Process CourseAllocation records (Lecture slots only, excluding TAs)
  for (const a of allocDocs) {
    const code = String(a.subjectCode || '').trim();
    const sec = String(a.section || '').trim();
    const yr = normalizeYear(a.year);
    if (!code || !sec || !yr) continue;

    const lSlots = Array.isArray(a.lectureSlots) && a.lectureSlots.length > 0
      ? a.lectureSlots
      : (a.lectureSlot?.empId ? [a.lectureSlot] : []);

    for (const slot of lSlots) {
      if (!slot?.empId) continue;
      if (isTADesignation(slot.designation)) continue; // Strictly exclude Supporting / TA

      const key = getRowKey(code, yr, sec);
      const facName = String(slot.empName || facultyMap.get(String(slot.empId).trim()) || slot.empId || '').trim();

      if (!rowsMap.has(key)) {
        rowsMap.set(key, {
          courseCode: code,
          courseName: String(a.subjectName || '').trim(),
          program: String(a.program || 'B.Tech').trim(),
          year: yr,
          section: sec,
          facultySet: new Set()
        });
      }
      const item = rowsMap.get(key);
      if (facName) item.facultySet.add(facName);
      if (!item.courseName && a.subjectName) item.courseName = String(a.subjectName).trim();
      if (!item.program && a.program) item.program = String(a.program).trim();
    }
  }

  // Convert to flat array and filter out rows without Main Faculty assigned
  const resultRows = [];
  for (const [, item] of rowsMap.entries()) {
    const facultyList = Array.from(item.facultySet).filter(Boolean);
    if (facultyList.length === 0) continue;

    // Sort faculty names alphabetically for consistent presentation
    facultyList.sort((a, b) => a.localeCompare(b));

    resultRows.push({
      courseCode: item.courseCode,
      courseName: item.courseName,
      mainFacultyAssigned: facultyList.join(', '),
      year: item.year,
      section: item.section,
      program: item.program || 'B.Tech'
    });
  }

  // Sort rows: Program -> Year (Roman order) -> Course Code -> Section (Natural sorting)
  resultRows.sort((a, b) => {
    if (a.program !== b.program) return (a.program || '').localeCompare(b.program || '');
    const ya = ROMAN_ORDER[a.year] || 99;
    const yb = ROMAN_ORDER[b.year] || 99;
    if (ya !== yb) return ya - yb;
    if (a.courseCode !== b.courseCode) return (a.courseCode || '').localeCompare(b.courseCode || '');
    return (a.section || '').localeCompare(b.section || '', undefined, { numeric: true, sensitivity: 'base' });
  });

  return resultRows;
};

/**
 * Generate Excel (.xlsx) file buffer for Course-wise Main Faculty Workload Export.
 * Columns:
 * 1. Course Code
 * 2. Course Name
 * 3. Main Faculty Assigned
 * 4. Year
 * 5. Section
 *
 * @param {Array} rows - Aggregate data rows
 * @param {Object} options - { academicYear, semester, program }
 * @returns {Promise<{ filename: string, content: Buffer, contentType: string }>}
 */
const exportCourseMainFacultyToExcel = async (rows = [], options = {}) => {
  const { academicYear, semester, program, format = 'excel' } = options;

  const columns = [
    { key: 'courseCode', header: 'Course Code', width: 18 },
    { key: 'courseName', header: 'Course Name', width: 42 },
    { key: 'mainFacultyAssigned', header: 'Main Faculty Assigned', width: 48 },
    { key: 'year', header: 'Year', width: 12 },
    { key: 'section', header: 'Section', width: 16 },
  ];

  const safeYear = (academicYear || 'All_Years').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeSem = (semester || 'All_Semesters').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeProg = (program || 'All_Programs').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];

  if (format === 'csv') {
    const csvContent = generateCSV(rows, columns);
    return {
      filename: `Course_Wise_Main_Faculty_Workload_${safeYear}_${safeSem}_${safeProg}_${dateStr}.csv`,
      content: csvContent,
      contentType: 'text/csv'
    };
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Faculty Workload Management System';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('Course Main Faculty', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  worksheet.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width }));

  // Header row formatting
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' } // Professional Navy Blue (#1E3A8A)
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  };

  headerRow.eachCell(cell => {
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    };
  });

  // Data rows formatting
  rows.forEach((item, index) => {
    const row = worksheet.addRow({
      courseCode: item.courseCode || '',
      courseName: item.courseName || '',
      mainFacultyAssigned: item.mainFacultyAssigned || '',
      year: item.year || '',
      section: item.section || ''
    });

    row.height = 22;
    row.font = { name: 'Calibri', size: 10 };

    row.getCell('courseCode').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('courseName').alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell('mainFacultyAssigned').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    row.getCell('year').alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell('section').alignment = { vertical: 'middle', horizontal: 'center' };

    const isEven = (index % 2 === 1);
    const rowBg = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

    row.eachCell(cell => {
      cell.border = thinBorder;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBg }
      };
    });
  });

  // Auto-filter on columns 1 to 5
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 5 }
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    filename: `Course_Wise_Main_Faculty_Workload_${safeYear}_${safeSem}_${safeProg}_${dateStr}.xlsx`,
    content: buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
};

module.exports = {
  getCourseMainFacultyWorkloadData,
  exportCourseMainFacultyToExcel,
};
