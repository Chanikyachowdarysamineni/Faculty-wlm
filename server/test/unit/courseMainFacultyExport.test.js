'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const workloadsRouter = require('../../src/routes/workloads');
const allocationsRouter = require('../../src/routes/allocations');
const User = require('../../src/models/User');
const Workload = require('../../src/models/Workload');
const CourseAllocation = require('../../src/models/CourseAllocation');
const Faculty = require('../../src/models/Faculty');
const Course = require('../../src/models/Course');
const { signToken } = require('../../src/utils/jwt');
const {
  getCourseMainFacultyWorkloadData,
  exportCourseMainFacultyToExcel
} = require('../../src/utils/workloadExportUtils');
const ExcelJS = require('exceljs');

const app = express();
app.use(express.json());
app.use('/api/workloads', workloadsRouter);
app.use('/api/allocations', allocationsRouter);

describe('Course-wise Main Faculty Workload Export Tests', () => {
  let adminToken;
  let nonAdminToken;
  const testAy = '2029-2030';
  const testSem = 'ODD';
  const testProgram = 'B.Tech';

  const testCourseCode = '99CS801';
  const testCourseName = 'Advanced Autonomous Systems';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Clean up any previous test artifacts
    await Workload.deleteMany({ academicYear: testAy });
    await CourseAllocation.deleteMany({ academicYear: testAy });

    // Ensure admin user
    let admin = await User.findOne({ role: 'admin', isDeleted: { $ne: true } }).lean();
    if (!admin) {
      admin = await User.create({
        empId: 'TEST_EXPORT_ADMIN',
        role: 'admin',
        canAccessAdmin: true
      });
    }

    adminToken = signToken({
      id: admin.empId,
      empId: admin.empId,
      role: 'admin',
      canAccessAdmin: true,
      tokenVersion: admin.tokenVersion || 0
    });

    let nonAdmin = await User.findOne({ empId: 'NON_ADMIN_FACULTY_123' }).lean();
    if (!nonAdmin) {
      nonAdmin = await User.create({
        empId: 'NON_ADMIN_FACULTY_123',
        passwordHash: 'dummyHash123',
        role: 'faculty',
        canAccessAdmin: false
      });
    }

    nonAdminToken = signToken({
      id: nonAdmin.empId,
      empId: nonAdmin.empId,
      role: 'faculty',
      canAccessAdmin: false,
      tokenVersion: nonAdmin.tokenVersion || 0
    });

    // Seed test workload and allocation data for isolated academicYear 2029-2030
    // 1. Single Main Faculty row: Year II, Section 1
    await Workload.create({
      empId: 'FAC_001',
      empName: 'Dr. Alan Turing',
      facultyRole: 'Main Faculty',
      subjectCode: testCourseCode,
      subjectName: testCourseName,
      program: testProgram,
      year: '2', // Will be normalized to 'II'
      section: '1',
      academicYear: testAy,
      semester: testSem,
      allocationStatus: 'ALLOCATED',
      isDeleted: false
    });

    // 2. Co-teaching: Multiple Main Faculty assigned to same course & section: Year II, Section 2 via CourseAllocation
    await Workload.create({
      empId: 'FAC_002',
      empName: 'Dr. Ada Lovelace',
      facultyRole: 'Main Faculty',
      subjectCode: testCourseCode,
      subjectName: testCourseName,
      program: testProgram,
      year: 'II',
      section: '2',
      academicYear: testAy,
      semester: testSem,
      allocationStatus: 'ALLOCATED',
      isDeleted: false
    });

    await CourseAllocation.create({
      courseId: 99992,
      subjectCode: testCourseCode,
      subjectName: testCourseName,
      program: testProgram,
      year: 'II',
      section: '2',
      academicYear: testAy,
      semester: testSem,
      lectureSlots: [
        {
          empId: 'FAC_002',
          empName: 'Dr. Ada Lovelace',
          designation: 'Professor',
          hours: 2
        },
        {
          empId: 'FAC_003',
          empName: 'Prof. Claude Shannon',
          designation: 'Professor',
          hours: 2
        }
      ],
      isDeleted: false
    });

    // 3. Separate Year and Section: Year III, Section 1
    await Workload.create({
      empId: 'FAC_004',
      empName: 'Dr. Grace Hopper',
      facultyRole: 'Main Faculty',
      subjectCode: testCourseCode,
      subjectName: testCourseName,
      program: testProgram,
      year: 'III',
      section: '1',
      academicYear: testAy,
      semester: testSem,
      allocationStatus: 'ALLOCATED',
      isDeleted: false
    });

    // 4. TA / Supporting Faculty assignment: Must NOT appear in Main Faculty export!
    await Workload.create({
      empId: 'FAC_TA_001',
      empName: 'Teaching Assistant Bob',
      facultyRole: 'TA',
      designation: 'Teaching Assistant',
      allocationRow: 1,
      subjectCode: testCourseCode,
      subjectName: testCourseName,
      program: testProgram,
      year: 'II',
      section: '1',
      academicYear: testAy,
      semester: testSem,
      allocationStatus: 'ALLOCATED',
      isDeleted: false
    });

    await Workload.create({
      empId: 'FAC_SUPP_001',
      empName: 'Supporting Faculty Charlie',
      facultyRole: 'Supporting Faculty',
      designation: 'Assistant Professor',
      allocationRow: 2,
      subjectCode: testCourseCode,
      subjectName: testCourseName,
      program: testProgram,
      year: 'II',
      section: '1',
      academicYear: testAy,
      semester: testSem,
      allocationStatus: 'ALLOCATED',
      isDeleted: false
    });

    // 5. CourseAllocation Lecture slot sync test: Year IV, Section 5
    await CourseAllocation.create({
      courseId: 99991,
      subjectCode: '99CS901',
      subjectName: 'Quantum Algorithms',
      program: 'M.Tech',
      year: 'I',
      section: '1',
      academicYear: testAy,
      semester: testSem,
      lectureSlots: [
        {
          empId: 'FAC_005',
          empName: 'Dr. Richard Feynman',
          designation: 'Professor',
          hours: 3
        },
        {
          empId: 'FAC_TA_999',
          empName: 'TA Student',
          designation: 'Teaching Assistant',
          hours: 2
        }
      ],
      isDeleted: false
    });
  });

  afterAll(async () => {
    await Workload.deleteMany({ academicYear: testAy });
    await CourseAllocation.deleteMany({ academicYear: testAy });
    await User.deleteMany({ empId: { $in: ['TEST_EXPORT_ADMIN', 'NON_ADMIN_FACULTY_123'] } });
  });

  test('1. getCourseMainFacultyWorkloadData aggregates correctly and handles multiple Main Faculty', async () => {
    const rows = await getCourseMainFacultyWorkloadData({
      academicYear: testAy,
      semester: testSem
    });

    expect(Array.isArray(rows)).toBe(true);
    // Should have 4 unique (course + year + section) combinations
    // - 99CS801, Year II, Sec 1 (Alan Turing)
    // - 99CS801, Year II, Sec 2 (Ada Lovelace, Claude Shannon)
    // - 99CS801, Year III, Sec 1 (Grace Hopper)
    // - 99CS901, Year I, Sec 1 (Richard Feynman)
    expect(rows.length).toBe(4);

    // Verify row 1: Single faculty
    const rowSec1 = rows.find(r => r.courseCode === testCourseCode && r.year === 'II' && r.section === '1');
    expect(rowSec1).toBeDefined();
    expect(rowSec1.mainFacultyAssigned).toBe('Dr. Alan Turing');
    expect(rowSec1.courseName).toBe(testCourseName);

    // Verify row 2: Co-teaching with multiple faculty combined
    const rowSec2 = rows.find(r => r.courseCode === testCourseCode && r.year === 'II' && r.section === '2');
    expect(rowSec2).toBeDefined();
    expect(rowSec2.mainFacultyAssigned).toContain('Dr. Ada Lovelace');
    expect(rowSec2.mainFacultyAssigned).toContain('Prof. Claude Shannon');
    expect(rowSec2.mainFacultyAssigned).toBe('Dr. Ada Lovelace, Prof. Claude Shannon');

    // Verify TAs and Supporting Faculty are excluded
    const allAssigned = rows.map(r => r.mainFacultyAssigned).join(' ');
    expect(allAssigned).not.toContain('Teaching Assistant Bob');
    expect(allAssigned).not.toContain('Supporting Faculty Charlie');
    expect(allAssigned).not.toContain('TA Student');

    // Verify Lecture slot from CourseAllocation
    const mtechRow = rows.find(r => r.courseCode === '99CS901');
    expect(mtechRow).toBeDefined();
    expect(mtechRow.mainFacultyAssigned).toBe('Dr. Richard Feynman');
  });

  test('2. Filter by Program isolates specific programme data', async () => {
    const btechRows = await getCourseMainFacultyWorkloadData({
      academicYear: testAy,
      semester: testSem,
      program: 'B.Tech'
    });

    expect(btechRows.length).toBe(3);
    expect(btechRows.every(r => r.program === 'B.Tech')).toBe(true);

    const mtechRows = await getCourseMainFacultyWorkloadData({
      academicYear: testAy,
      semester: testSem,
      program: 'M.Tech'
    });

    expect(mtechRows.length).toBe(1);
    expect(mtechRows[0].courseCode).toBe('99CS901');
  });

  test('3. exportCourseMainFacultyToExcel generates properly formatted Excel file with exact 5 columns', async () => {
    const rows = await getCourseMainFacultyWorkloadData({
      academicYear: testAy,
      semester: testSem
    });

    const exportResult = await exportCourseMainFacultyToExcel(rows, {
      academicYear: testAy,
      semester: testSem,
      program: 'All'
    });

    expect(exportResult).toBeDefined();
    expect(exportResult.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(exportResult.filename).toContain('.xlsx');
    expect(Buffer.isBuffer(exportResult.content)).toBe(true);

    // Read back the Excel buffer and verify structure
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exportResult.content);

    const worksheet = workbook.getWorksheet('Course Main Faculty');
    expect(worksheet).toBeDefined();

    // Check header row (row 1)
    const headerRow = worksheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell) => {
      headers.push(cell.value);
    });

    expect(headers).toEqual([
      'Course Code',
      'Course Name',
      'Main Faculty Assigned',
      'Year',
      'Section'
    ]);

    // Check data row count
    expect(worksheet.rowCount).toBe(rows.length + 1); // headers + data rows
  });

  test('4. GET /api/workloads/export/course-main-faculty?format=json returns structured JSON data', async () => {
    const res = await request(app)
      .get('/api/workloads/export/course-main-faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        academicYear: testAy,
        semester: testSem,
        format: 'json'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.count).toBe(4);
    expect(Array.isArray(res.body.data.rows)).toBe(true);
    expect(res.body.data.rows[0]).toHaveProperty('courseCode');
    expect(res.body.data.rows[0]).toHaveProperty('courseName');
    expect(res.body.data.rows[0]).toHaveProperty('mainFacultyAssigned');
    expect(res.body.data.rows[0]).toHaveProperty('year');
    expect(res.body.data.rows[0]).toHaveProperty('section');
  });

  test('5. GET /api/workloads/export/course-main-faculty?format=excel downloads .xlsx file', async () => {
    const res = await request(app)
      .get('/api/workloads/export/course-main-faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        academicYear: testAy,
        semester: testSem,
        format: 'excel'
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('.xlsx');
  });

  test('6. GET /api/allocations/export/course-main-faculty alias endpoint works identically', async () => {
    const res = await request(app)
      .get('/api/allocations/export/course-main-faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        academicYear: testAy,
        semester: testSem,
        format: 'json'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.count).toBe(4);
  });

  test('7. Unauthorized or non-admin users cannot access the export endpoint', async () => {
    const resNoAuth = await request(app)
      .get('/api/workloads/export/course-main-faculty');
    expect([401, 403]).toContain(resNoAuth.status);

    const resNonAdmin = await request(app)
      .get('/api/workloads/export/course-main-faculty')
      .set('Authorization', `Bearer ${nonAdminToken}`);
    expect(resNonAdmin.status).toBe(403);
  });
});
