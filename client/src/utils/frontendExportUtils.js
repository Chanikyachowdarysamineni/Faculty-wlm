/**
 * utils/frontendExportUtils.js - Frontend data export functions for all modules
 * Provides CSV/Excel/PDF export for all table data types
 */

import { exportAsCSV, exportAsExcel, exportAsPDF } from './exportUtils';

/**
 * Export Faculty List
 */
export const exportFacultyList = (facultyList) => {
  const columns = [
    { key: 'empId', header: 'Employee ID' },
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'mobile', header: 'Mobile' },
    { key: 'designation', header: 'Designation' },
    { key: 'department', header: 'Department' },
  ];

  // CSV
  exportAsCSV({
    fileName: `faculty-list-${new Date().toISOString().split('T')[0]}.csv`,
    columns,
    rows: facultyList,
  });
};

export const exportFacultyListExcel = (facultyList) => {
  const columns = [
    { key: 'empId', header: 'Employee ID' },
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'mobile', header: 'Mobile' },
    { key: 'designation', header: 'Designation' },
    { key: 'department', header: 'Department' },
  ];

  exportAsExcel({
    fileName: `faculty-list-${new Date().toISOString().split('T')[0]}.xlsx`,
    columns,
    rows: facultyList,
    sheetName: 'Faculty',
  });
};

/**
 * Export Courses List
 */
export const exportCoursesList = (coursesList) => {
  const columns = [
    { key: 'courseCode', header: 'Course Code' },
    { key: 'courseName', header: 'Course Name' },
    { key: 'courseType', header: 'Type' },
    { key: 'credits', header: 'Credits' },
    { key: 'year', header: 'Year' },
    { key: 'section', header: 'Section' },
  ];

  exportAsCSV({
    fileName: `courses-list-${new Date().toISOString().split('T')[0]}.csv`,
    columns,
    rows: coursesList,
  });
};

export const exportCoursesListExcel = (coursesList) => {
  const columns = [
    { key: 'courseCode', header: 'Course Code' },
    { key: 'courseName', header: 'Course Name' },
    { key: 'courseType', header: 'Type' },
    { key: 'credits', header: 'Credits' },
    { key: 'year', header: 'Year' },
    { key: 'section', header: 'Section' },
  ];

  exportAsExcel({
    fileName: `courses-list-${new Date().toISOString().split('T')[0]}.xlsx`,
    columns,
    rows: coursesList,
    sheetName: 'Courses',
  });
};

/**
 * Export Workload List
 */
export const exportWorkloadList = (workloadList, facultyMap = {}) => {
  const columns = [
    { key: 'empId', header: 'Employee ID' },
    { 
      key: 'empId',
      header: 'Faculty Name',
      value: (row) => facultyMap[row.empId]?.name || row.empId
    },
    { key: 'designation', header: 'Designation' },
    { key: 'department', header: 'Department' },
    { key: 'courseCode', header: 'Course Code' },
    { 
      key: 'courseCode',
      header: 'Course Name',
      value: (row) => facultyMap[row.courseCode]?.name || row.courseCode
    },
    { key: 'credits', header: 'Credits' },
    { key: 'sections', header: 'Sections' },
  ];

  exportAsCSV({
    fileName: `workload-list-${new Date().toISOString().split('T')[0]}.csv`,
    columns,
    rows: workloadList,
  });
};

export const exportWorkloadListExcel = (workloadList, facultyMap = {}) => {
  const columns = [
    { key: 'empId', header: 'Employee ID' },
    { 
      key: 'empId',
      header: 'Faculty Name',
      value: (row) => facultyMap[row.empId]?.name || row.empId
    },
    { key: 'designation', header: 'Designation' },
    { key: 'department', header: 'Department' },
    { key: 'courseCode', header: 'Course Code' },
    { key: 'credits', header: 'Credits' },
    { key: 'sections', header: 'Sections' },
  ];

  exportAsExcel({
    fileName: `workload-list-${new Date().toISOString().split('T')[0]}.xlsx`,
    columns,
    rows: workloadList,
    sheetName: 'Workload',
  });
};

/**
 * Export Allocations
 */
export const exportAllocationsList = (allocationsList) => {
  const columns = [
    { key: 'empId', header: 'Employee ID' },
    { key: 'name', header: 'Faculty Name' },
    { key: 'courseCode', header: 'Course Code' },
    { key: 'courseName', header: 'Course Name' },
    { key: 'credits', header: 'Credits' },
    { key: 'type', header: 'Allocation Type' },
  ];

  exportAsCSV({
    fileName: `allocations-${new Date().toISOString().split('T')[0]}.csv`,
    columns,
    rows: allocationsList,
  });
};

export const exportAllocationsListExcel = (allocationsList) => {
  const columns = [
    { key: 'empId', header: 'Employee ID' },
    { key: 'name', header: 'Faculty Name' },
    { key: 'courseCode', header: 'Course Code' },
    { key: 'courseName', header: 'Course Name' },
    { key: 'credits', header: 'Credits' },
    { key: 'type', header: 'Allocation Type' },
  ];

  exportAsExcel({
    fileName: `allocations-${new Date().toISOString().split('T')[0]}.xlsx`,
    columns,
    rows: allocationsList,
    sheetName: 'Allocations',
  });
};

/**
 * Export Audit Logs
 */
export const exportAuditLogs = (auditLogs) => {
  const columns = [
    { key: 'userId', header: 'User ID' },
    { key: 'action', header: 'Action' },
    { key: 'module', header: 'Module' },
    { key: 'details', header: 'Details' },
    { 
      key: 'timestamp',
      header: 'Timestamp',
      value: (row) => new Date(row.timestamp).toLocaleString()
    },
    { key: 'ipAddress', header: 'IP Address' },
  ];

  exportAsCSV({
    fileName: `audit-logs-${new Date().toISOString().split('T')[0]}.csv`,
    columns,
    rows: auditLogs,
  });
};

export const exportAuditLogsExcel = (auditLogs) => {
  const columns = [
    { key: 'userId', header: 'User ID' },
    { key: 'action', header: 'Action' },
    { key: 'module', header: 'Module' },
    { key: 'details', header: 'Details' },
    { 
      key: 'timestamp',
      header: 'Timestamp',
      value: (row) => new Date(row.timestamp).toLocaleString()
    },
    { key: 'ipAddress', header: 'IP Address' },
  ];

  exportAsExcel({
    fileName: `audit-logs-${new Date().toISOString().split('T')[0]}.xlsx`,
    columns,
    rows: auditLogs,
    sheetName: 'Audit Logs',
  });
};

/**
 * Print utility - for printing any table data
 */
export const printData = (title, data) => {
  const printWindow = window.open('', '', 'height=400,width=800');
  printWindow.document.write('<html><head><title>Print</title>');
  printWindow.document.write('<style>');
  printWindow.document.write('body { font-family: Arial, sans-serif; margin: 20px; }');
  printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-top: 20px; }');
  printWindow.document.write('th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }');
  printWindow.document.write('th { background-color: #f2f2f2; font-weight: bold; }');
  printWindow.document.write('h1 { color: #333; }');
  printWindow.document.write('</style></head><body>');
  printWindow.document.write(`<h1>${title}</h1>`);
  printWindow.document.write(data);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.print();
};

