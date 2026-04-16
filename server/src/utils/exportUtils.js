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

  // Escape CSV values
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
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
 * Generate Excel buffer from data array
 * @param {Array} data - Array of objects to export
 * @param {Array} columns - Array of {key, header, width} objects
 * @param {String} sheetName - Worksheet name
 * @returns {Promise<Buffer>} Excel file buffer
 */
const generateExcel = async (data = [], columns = [], sheetName = 'Data') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Add headers
  const headers = columns.map(col => col.header);
  const headerRow = worksheet.addRow(headers);

  // Style header row
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  // Set column widths
  columns.forEach((col, idx) => {
    worksheet.columns[idx].width = col.width || 18;
  });

  // Add data rows
  data.forEach(item => {
    const rowData = columns.map(col => item[col.key] || '');
    const row = worksheet.addRow(rowData);
    row.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  });

  // Freeze header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  return await workbook.xlsx.writeBuffer();
};

/**
 * Export submissions data
 * @param {Array} submissions - Array of submission objects
 * @param {Array} courses - Array of course objects for lookup
 * @param {String} format - 'csv' or 'excel'
 * @returns {Object} {filename, content, contentType}
 */
const exportSubmissions = async (submissions = [], courses = [], format = 'csv') => {
  // Create courseId -> shortName map
  const courseMap = {};
  (courses || []).forEach(course => {
    courseMap[course.courseId] = course.shortName || `Course ${course.courseId}`;
  });

  const columns = [
    { key: 'empId', header: 'Employee ID', width: 12 },
    { key: 'empName', header: 'Faculty Name', width: 25 },
    { key: 'designation', header: 'Designation', width: 20 },
    { key: 'mobile', header: 'Mobile', width: 15 },
    { key: 'pref1', header: 'Preference 1', width: 20 },
    { key: 'pref2', header: 'Preference 2', width: 20 },
    { key: 'pref3', header: 'Preference 3', width: 20 },
    { key: 'pref4', header: 'Preference 4', width: 20 },
    { key: 'pref5', header: 'Preference 5', width: 20 },
    { key: 'submittedAt', header: 'Submitted At', width: 20 },
    { key: 'updatedAt', header: 'Last Updated', width: 20 },
  ];

  // Transform data for export
  const exportData = submissions.map(sub => ({
    empId: sub.empId || '',
    empName: sub.empName || '',
    designation: sub.designation || 'N/A',
    mobile: sub.mobile || 'N/A',
    pref1: courseMap[sub.prefs?.[0]] || '—',
    pref2: courseMap[sub.prefs?.[1]] || '—',
    pref3: courseMap[sub.prefs?.[2]] || '—',
    pref4: courseMap[sub.prefs?.[3]] || '—',
    pref5: courseMap[sub.prefs?.[4]] || '—',
    submittedAt: sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : '',
    updatedAt: sub.updatedAt ? new Date(sub.updatedAt).toLocaleString() : '',
  }));

  if (format === 'excel') {
    const buffer = await generateExcel(exportData, columns, 'Submissions');
    return {
      filename: `submissions_${new Date().toISOString().split('T')[0]}.xlsx`,
      content: buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  // Default to CSV
  const content = generateCSV(exportData, columns);
  return {
    filename: `submissions_${new Date().toISOString().split('T')[0]}.csv`,
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
  exportSubmissions,
  exportCourses,
  exportFaculty,
};
