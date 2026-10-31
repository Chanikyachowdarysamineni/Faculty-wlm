/**
 * utils/exportUtils.js
 * 
 * Export utilities for generating CSV and Excel files
 * Supports submissions, courses, faculty, workloads, etc.
 */

'use strict';

const ExcelJS = require('exceljs');

/**
 * Generate CSV string from data array and column definitions
 * @param {Array} data - Array of objects to export
 * @param {Array} columns - Array of {key, header} objects
 * @returns {String} CSV content
 */
const generateCSV = (data = [], columns = []) => {
  if (!data.length || !columns.length) {
    return '';
  }

  // Escape CSV values and neutralize formula injection (CWE-1236 fix)
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    let str = String(val);
    if (/^[=+@\-\t\r]/.test(str)) {
      str = `'${str}`;
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Create header row
  const headers = columns.map(col => escapeCSV(col.header)).join(',');

  // Create data rows
  const rows = data.map(row => {
    return columns.map(col => {
      const val = row[col.key];
      return escapeCSV(val);
    }).join(',');
  });

  return [headers, ...rows].join('\n');
};

/**
 * Generate Excel buffer from data array (single worksheet)
 * @param {Array} data - Array of objects to export
 * @param {Array} columns - Array of {key, header, width} objects
 * @param {String} sheetName - Worksheet name
 * @returns {Promise<Buffer>} Excel file buffer
 */
const generateExcel = async (data = [], columns = [], sheetName = 'Data') => {
  return await generateMultiSheetExcel([
    {
      name: sheetName,
      columns,
      data,
      headerColor: 'FF366092',
    }
  ]);
};

/**
 * Generate multi-sheet Excel buffer from array of sheet specifications
 * @param {Array} sheets - Array of { name, columns, data, headerColor } objects
 * @returns {Promise<Buffer>} Excel file buffer
 */
const generateMultiSheetExcel = async (sheets = []) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Faculty Workload Management System';
  workbook.created = new Date();
  workbook.modified = new Date();

  for (const sheetDef of sheets) {
    const { name, columns = [], data = [], headerColor = 'FF1E3A8A' } = sheetDef;
    const worksheet = workbook.addWorksheet(name, {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    // Add headers
    const headers = columns.map(col => col.header);
    const headerRow = worksheet.addRow(headers);

    // Style header row
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.height = 26;

    // Set column widths
    columns.forEach((col, idx) => {
      worksheet.getColumn(idx + 1).width = col.width || 18;
    });

    // Add data rows
    data.forEach((item, itemIdx) => {
      const rowData = columns.map(col => {
        const val = item[col.key];
        return val === null || val === undefined ? '' : val;
      });
      const row = worksheet.addRow(rowData);
      row.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
      row.height = 20;

      // Alternating row styling
      if (itemIdx % 2 === 1) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }
        };
      }
    });

    // Enable autoFilter across the table columns
    if (columns.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length }
      };
    }
  }

  return await workbook.xlsx.writeBuffer();
};

/**
 * Export submissions data with two separate worksheets:
 * Sheet 1: Submitted Faculty
 * Sheet 2: Not Submitted Faculty
 * 
 * @param {Array|Object} submissionsOrConfig - Array of submissions or config object
 * @param {Array} [courses] - Array of course objects for lookup
 * @param {String} [format] - 'csv' or 'excel'
 * @param {Object} [options] - Additional options (notSubmitted, academicYear, semester)
 * @returns {Promise<Object>} { filename, content, contentType }
 */
const exportSubmissions = async (submissionsOrConfig = [], courses = [], format = 'csv', options = {}) => {
  let submissions = [];
  let notSubmitted = [];
  let courseList = courses;
  let exportFormat = format;
  let academicYear = '';
  let semester = '';

  if (submissionsOrConfig && typeof submissionsOrConfig === 'object' && !Array.isArray(submissionsOrConfig)) {
    submissions = submissionsOrConfig.submissions || [];
    notSubmitted = submissionsOrConfig.notSubmitted || [];
    courseList = submissionsOrConfig.courses || courses || [];
    exportFormat = submissionsOrConfig.format || format || 'csv';
    academicYear = submissionsOrConfig.academicYear || '';
    semester = submissionsOrConfig.semester || '';
  } else {
    submissions = submissionsOrConfig || [];
    if (Array.isArray(options)) {
      notSubmitted = options;
    } else if (options && typeof options === 'object') {
      notSubmitted = options.notSubmitted || [];
      academicYear = options.academicYear || '';
      semester = options.semester || '';
    }
  }

  // Create courseId -> label map
  const courseMap = {};
  (courseList || []).forEach(course => {
    courseMap[course.courseId] = course.shortName || course.name || `Course ${course.courseId}`;
  });

  // Sheet 1 Column Definitions: Submitted Faculty
  const submittedColumns = [
    { key: 'empId', header: 'Employee ID', width: 14 },
    { key: 'empName', header: 'Faculty Name', width: 26 },
    { key: 'designation', header: 'Designation', width: 24 },
    { key: 'email', header: 'Email', width: 28 },
    { key: 'mobile', header: 'Mobile Number', width: 16 },
    { key: 'status', header: 'Submission Status', width: 18 },
    { key: 'submittedAt', header: 'Submission Date & Time', width: 22 },
    { key: 'pref1', header: 'Preference 1', width: 24 },
    { key: 'pref2', header: 'Preference 2', width: 24 },
    { key: 'pref3', header: 'Preference 3', width: 24 },
    { key: 'pref4', header: 'Preference 4', width: 24 },
    { key: 'pref5', header: 'Preference 5', width: 24 },
    { key: 'updatedAt', header: 'Last Updated', width: 22 },
  ];

  // Sheet 2 Column Definitions: Not Submitted Faculty
  const notSubmittedColumns = [
    { key: 'empId', header: 'Employee ID', width: 14 },
    { key: 'empName', header: 'Faculty Name', width: 26 },
    { key: 'designation', header: 'Designation', width: 24 },
    { key: 'email', header: 'Email', width: 28 },
    { key: 'mobile', header: 'Mobile Number', width: 16 },
    { key: 'status', header: 'Submission Status', width: 18 },
    { key: 'department', header: 'Department', width: 16 },
    { key: 'capacity', header: 'Weekly Capacity (Hrs)', width: 22 },
    { key: 'joiningDate', header: 'Joining Date', width: 16 },
    { key: 'relievingDate', header: 'Relieving Date', width: 16 },
  ];

  // Transform Submitted Faculty records
  const exportSubmittedData = submissions.map(sub => ({
    empId: String(sub.empId || '').trim(),
    empName: String(sub.empName || sub.name || '').trim(),
    designation: String(sub.designation || 'N/A').trim(),
    email: String(sub.email || '').trim() || '—',
    mobile: String(sub.mobile || 'N/A').trim(),
    status: 'Submitted',
    pref1: courseMap[sub.prefs?.[0]] || (sub.prefs?.[0] ? `Course ${sub.prefs[0]}` : '—'),
    pref2: courseMap[sub.prefs?.[1]] || (sub.prefs?.[1] ? `Course ${sub.prefs[1]}` : '—'),
    pref3: courseMap[sub.prefs?.[2]] || (sub.prefs?.[2] ? `Course ${sub.prefs[2]}` : '—'),
    pref4: courseMap[sub.prefs?.[3]] || (sub.prefs?.[3] ? `Course ${sub.prefs[3]}` : '—'),
    pref5: courseMap[sub.prefs?.[4]] || (sub.prefs?.[4] ? `Course ${sub.prefs[4]}` : '—'),
    submittedAt: sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : '—',
    updatedAt: sub.updatedAt ? new Date(sub.updatedAt).toLocaleString() : '—',
  }));

  // Transform Not Submitted Faculty records
  const exportNotSubmittedData = notSubmitted.map(fac => ({
    empId: String(fac.empId || '').trim(),
    empName: String(fac.empName || fac.name || '').trim(),
    designation: String(fac.designation || 'N/A').trim(),
    email: String(fac.email || '').trim() || '—',
    mobile: String(fac.mobile || 'N/A').trim(),
    status: 'Not Submitted',
    department: String(fac.department || 'CSE').trim(),
    capacity: fac.capacity !== undefined ? fac.capacity : '—',
    joiningDate: fac.joiningDate ? (String(fac.joiningDate).includes('T') ? new Date(fac.joiningDate).toLocaleDateString('en-GB') : fac.joiningDate) : '—',
    relievingDate: fac.relievingDate ? (String(fac.relievingDate).includes('T') ? new Date(fac.relievingDate).toLocaleDateString('en-GB') : fac.relievingDate) : '—',
  }));

  const safeYear = academicYear ? String(academicYear).replace(/[^a-zA-Z0-9_-]/g, '_') : '';
  const safeSem = semester ? String(semester).replace(/[^a-zA-Z0-9_-]/g, '_') : '';
  const filePrefix = safeYear && safeSem ? `faculty_form_submissions_${safeYear}_${safeSem}` : 'faculty_form_submissions';
  const dateStr = new Date().toISOString().split('T')[0];

  // Return Excel workbook with TWO worksheets
  if (exportFormat === 'excel') {
    const buffer = await generateMultiSheetExcel([
      {
        name: 'Submitted Faculty',
        columns: submittedColumns,
        data: exportSubmittedData,
        headerColor: 'FF1E3A8A', // Deep Indigo / Navy
      },
      {
        name: 'Not Submitted Faculty',
        columns: notSubmittedColumns,
        data: exportNotSubmittedData,
        headerColor: 'FF0F766E', // Deep Teal / Slate
      },
    ]);

    return {
      filename: `${filePrefix}_${dateStr}.xlsx`,
      content: buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  // Combined fallback for CSV format (single-sheet tabular data)
  const combinedCsvColumns = [
    { key: 'empId', header: 'Employee ID' },
    { key: 'empName', header: 'Faculty Name' },
    { key: 'designation', header: 'Designation' },
    { key: 'email', header: 'Email' },
    { key: 'mobile', header: 'Mobile Number' },
    { key: 'status', header: 'Submission Status' },
    { key: 'submittedAt', header: 'Submission Date & Time' },
    { key: 'pref1', header: 'Preference 1' },
    { key: 'pref2', header: 'Preference 2' },
    { key: 'pref3', header: 'Preference 3' },
    { key: 'pref4', header: 'Preference 4' },
    { key: 'pref5', header: 'Preference 5' },
    { key: 'department', header: 'Department' },
    { key: 'capacity', header: 'Weekly Capacity (Hrs)' },
    { key: 'joiningDate', header: 'Joining Date' },
    { key: 'relievingDate', header: 'Relieving Date' },
    { key: 'updatedAt', header: 'Last Updated' },
  ];

  const combinedData = [
    ...exportSubmittedData.map(d => ({ ...d, department: 'CSE', capacity: '—', joiningDate: '—', relievingDate: '—' })),
    ...exportNotSubmittedData.map(d => ({ ...d, submittedAt: '—', pref1: '—', pref2: '—', pref3: '—', pref4: '—', pref5: '—', updatedAt: '—' }))
  ];

  const content = generateCSV(combinedData, combinedCsvColumns);
  return {
    filename: `${filePrefix}_${dateStr}.csv`,
    content,
    contentType: 'text/csv',
  };
};

/**
 * Export courses data
 * @param {Array} courses - Array of course objects
 * @param {String} format - 'csv' or 'excel'
 * @returns {Object} {filename, content, contentType}
 */
const exportCourses = async (courses = [], format = 'csv') => {
  const columns = [
    { key: 'courseId', header: 'Course ID', width: 12 },
    { key: 'courseCode', header: 'Course Code', width: 15 },
    { key: 'courseName', header: 'Course Name', width: 30 },
    { key: 'semester', header: 'Semester', width: 12 },
    { key: 'credits', header: 'Credits', width: 10 },
    { key: 'seatsAvailable', header: 'Seats Available', width: 15 },
  ];

  if (format === 'excel') {
    const buffer = await generateExcel(courses, columns, 'Courses');
    return {
      filename: `courses_${new Date().toISOString().split('T')[0]}.xlsx`,
      content: buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  const content = generateCSV(courses, columns);
  return {
    filename: `courses_${new Date().toISOString().split('T')[0]}.csv`,
    content,
    contentType: 'text/csv',
  };
};

/**
 * Export faculty data
 * @param {Array} faculty - Array of faculty objects
 * @param {String} format - 'csv' or 'excel'
 * @returns {Object} {filename, content, contentType}
 */
const exportFaculty = async (faculty = [], format = 'csv') => {
  const columns = [
    { key: 'empId', header: 'Employee ID', width: 12 },
    { key: 'empName', header: 'Faculty Name', width: 25 },
    { key: 'designation', header: 'Designation', width: 20 },
    { key: 'dept', header: 'Department', width: 20 },
    { key: 'email', header: 'Email', width: 25 },
    { key: 'mobile', header: 'Mobile', width: 15 },
  ];

  if (format === 'excel') {
    const buffer = await generateExcel(faculty, columns, 'Faculty');
    return {
      filename: `faculty_${new Date().toISOString().split('T')[0]}.xlsx`,
      content: buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  const content = generateCSV(faculty, columns);
  return {
    filename: `faculty_${new Date().toISOString().split('T')[0]}.csv`,
    content,
    contentType: 'text/csv',
  };
};

module.exports = {
  generateCSV,
  generateExcel,
  generateMultiSheetExcel,
  exportSubmissions,
  exportCourses,
  exportFaculty,
};
