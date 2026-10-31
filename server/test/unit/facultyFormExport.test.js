'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const request = require('supertest');
const ExcelJS = require('exceljs');
const app = require('../../src/index');
const Faculty = require('../../src/models/Faculty');
const Submission = require('../../src/models/Submission');
const Course = require('../../src/models/Course');
const User = require('../../src/models/User');
const AcademicYear = require('../../src/models/AcademicYear');
const AcademicYearSemester = require('../../src/models/AcademicYearSemester');
const { signToken } = require('../../src/utils/jwt');
const { generateMultiSheetExcel, exportSubmissions } = require('../../src/utils/exportUtils');

describe('Faculty Form Two-Sheet Excel Export Suite', () => {
  let adminToken;
  let testAyId;
  let testSemId;
  let testFacultySubmitted;
  let testFacultyNotSubmitted;
  let testCourse;
  let testSubmission;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/faculty_workload');
    }

    // Ensure admin user for auth
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      adminUser = await User.create({
        empId: 'TEST_ADMIN_EXP_01',
        name: 'Test Admin Export',
        role: 'admin',
        tokenVersion: 1
      });
    }

    adminToken = signToken({
      id: adminUser.empId,
      empId: adminUser.empId,
      role: 'admin',
      tokenVersion: adminUser.tokenVersion || 0
    });

    // Ensure AcademicYear
    let ay = await AcademicYear.findOne({ name: '2026-2027' });
    if (!ay) {
      ay = await AcademicYear.create({
        name: '2026-2027',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-05-31'),
        status: 'active'
      });
    }
    testAyId = ay._id;

    // Ensure AcademicYearSemester
    let sem = await AcademicYearSemester.findOne({ academicYearId: testAyId, semesterType: 'ODD' });
    if (!sem) {
      sem = await AcademicYearSemester.create({
        academicYearId: testAyId,
        semesterType: 'ODD',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-12-31'),
        status: 'active'
      });
    }
    testSemId = sem._id;

    // Create course for preferences
    const cid = 98765;
    await Course.deleteOne({ courseId: cid });
    testCourse = await Course.create({
      courseId: cid,
      subjectCode: 'CS98765',
      subjectName: 'Advanced Algorithms Export Test',
      program: 'B.Tech',
      courseType: 'Core',
      shortName: 'AA-EXP',
      semester: 'ODD',
      academicYear: '2026-2027',
      academicYearSemesterId: testSemId,
      L: 3, T: 1, P: 0, C: 4
    });

    // Clean up test faculty & submissions
    await Faculty.deleteMany({ empId: { $in: ['TEST_FAC_SUB_01', 'TEST_FAC_NOTSUB_01'] } });
    await Submission.deleteMany({ empId: 'TEST_FAC_SUB_01' });

    testFacultySubmitted = await Faculty.create({
      empId: 'TEST_FAC_SUB_01',
      name: 'Dr. Alice Submitted',
      designation: 'Associate Professor',
      department: 'CSE',
      email: 'alice.sub@univ.edu',
      mobile: '9876543210',
      capacity: 18,
      joiningDate: new Date('2024-01-01'),
      isDeleted: false
    });

    testFacultyNotSubmitted = await Faculty.create({
      empId: 'TEST_FAC_NOTSUB_01',
      name: 'Prof. Bob NotSubmitted',
      designation: 'Assistant Professor',
      department: 'CSE',
      email: 'bob.notsub@univ.edu',
      mobile: '9876543211',
      capacity: 18,
      joiningDate: new Date('2024-01-01'),
      isDeleted: false
    });

    testSubmission = await Submission.create({
      empId: 'TEST_FAC_SUB_01',
      empName: 'Dr. Alice Submitted',
      designation: 'Associate Professor',
      mobile: '9876543210',
      prefs: [cid],
      semester: 'ODD',
      academicYear: '2026-2027',
      academicYearSemesterId: testSemId
    });
  });

  afterAll(async () => {
    await Faculty.deleteMany({ empId: { $in: ['TEST_FAC_SUB_01', 'TEST_FAC_NOTSUB_01'] } });
    await Submission.deleteMany({ empId: 'TEST_FAC_SUB_01' });
    if (testCourse) await Course.deleteOne({ _id: testCourse._id });
  });

  describe('1. Unit Tests for Multi-Sheet Excel Generator', () => {
    test('generateMultiSheetExcel creates a workbook buffer with two distinct sheets', async () => {
      const buffer = await generateMultiSheetExcel([
        {
          name: 'Submitted Faculty',
          columns: [
            { key: 'empId', header: 'Employee ID' },
            { key: 'name', header: 'Faculty Name' }
          ],
          data: [{ empId: 'E1', name: 'Alice' }]
        },
        {
          name: 'Not Submitted Faculty',
          columns: [
            { key: 'empId', header: 'Employee ID' },
            { key: 'name', header: 'Faculty Name' }
          ],
          data: [{ empId: 'E2', name: 'Bob' }]
        }
      ]);

      expect(Buffer.isBuffer(buffer)).toBe(true);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      expect(workbook.worksheets.length).toBe(2);
      expect(workbook.getWorksheet('Submitted Faculty')).toBeDefined();
      expect(workbook.getWorksheet('Not Submitted Faculty')).toBeDefined();
    });

    test('exportSubmissions formats two worksheets with exact required column headers and values', async () => {
      const result = await exportSubmissions({
        submissions: [
          {
            empId: 'E1',
            empName: 'Alice',
            designation: 'Professor',
            email: 'alice@test.com',
            mobile: '1234567890',
            status: 'Submitted',
            prefs: [101],
            submittedAt: '2026-10-31T10:00:00Z',
            updatedAt: '2026-10-31T10:00:00Z'
          }
        ],
        notSubmitted: [
          {
            empId: 'E2',
            empName: 'Bob',
            designation: 'Assistant Professor',
            email: 'bob@test.com',
            mobile: '9876543210',
            status: 'Not Submitted',
            department: 'CSE',
            capacity: 18,
            joiningDate: '2024-01-01',
            relievingDate: '—'
          }
        ],
        courses: [{ courseId: 101, shortName: 'DSA' }],
        format: 'excel',
        academicYear: '2026-2027',
        semester: 'ODD'
      });

      expect(result.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.filename).toMatch(/faculty_form_submissions_2026-2027_ODD_.*\.xlsx/);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(result.content);

      // Sheet 1: Submitted Faculty
      const sheet1 = workbook.getWorksheet('Submitted Faculty');
      expect(sheet1).toBeDefined();
      expect(sheet1.rowCount).toBe(2); // 1 header + 1 data row
      expect(sheet1.getRow(1).values).toEqual(expect.arrayContaining([
        'Employee ID', 'Faculty Name', 'Designation', 'Email', 'Mobile Number', 'Submission Status'
      ]));
      expect(sheet1.getRow(2).getCell(1).value).toBe('E1');
      expect(sheet1.getRow(2).getCell(2).value).toBe('Alice');
      expect(sheet1.getRow(2).getCell(6).value).toBe('Submitted');
      expect(sheet1.getRow(2).getCell(8).value).toBe('DSA');

      // Sheet 2: Not Submitted Faculty
      const sheet2 = workbook.getWorksheet('Not Submitted Faculty');
      expect(sheet2).toBeDefined();
      expect(sheet2.rowCount).toBe(2); // 1 header + 1 data row
      expect(sheet2.getRow(1).values).toEqual(expect.arrayContaining([
        'Employee ID', 'Faculty Name', 'Designation', 'Email', 'Mobile Number', 'Submission Status', 'Department', 'Weekly Capacity (Hrs)'
      ]));
      expect(sheet2.getRow(2).getCell(1).value).toBe('E2');
      expect(sheet2.getRow(2).getCell(2).value).toBe('Bob');
      expect(sheet2.getRow(2).getCell(6).value).toBe('Not Submitted');
      expect(sheet2.getRow(2).getCell(7).value).toBe('CSE');
    });

    test('Zero submissions case: generates both worksheets with full column headers and zero data rows in Sheet 1', async () => {
      const result = await exportSubmissions({
        submissions: [],
        notSubmitted: [
          {
            empId: 'E3',
            empName: 'Charlie',
            designation: 'Lecturer',
            email: 'charlie@test.com',
            mobile: '5555555555',
            status: 'Not Submitted',
            department: 'CSE',
            capacity: 12
          }
        ],
        courses: [],
        format: 'excel',
        academicYear: '2026-2027',
        semester: 'ODD'
      });

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(result.content);

      const sheet1 = workbook.getWorksheet('Submitted Faculty');
      const sheet2 = workbook.getWorksheet('Not Submitted Faculty');

      expect(sheet1).toBeDefined();
      expect(sheet2).toBeDefined();
      expect(sheet1.rowCount).toBe(1); // Only headers
      expect(sheet2.rowCount).toBe(2); // Header + Charlie
    });
  });

  describe('2. Endpoint Integration: GET /api/submissions/export', () => {
    test('GET /api/submissions/export?format=excel downloads .xlsx containing Submitted & Not Submitted sheets with accurate counts', async () => {
      const res = await request(app)
        .get('/api/submissions/export')
        .query({
          format: 'excel',
          academicYear: '2026-2027',
          semester: 'ODD'
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse((res, callback) => {
          const data = [];
          res.on('data', chunk => data.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(data)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="faculty_form_submissions_.*\.xlsx"/);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);

      const sheet1 = workbook.getWorksheet('Submitted Faculty');
      const sheet2 = workbook.getWorksheet('Not Submitted Faculty');

      expect(sheet1).toBeDefined();
      expect(sheet2).toBeDefined();

      // Find our test faculty in the exported sheets
      let foundInSheet1 = false;
      sheet1.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && row.getCell(1).value === 'TEST_FAC_SUB_01') {
          foundInSheet1 = true;
          expect(row.getCell(2).value).toBe('Dr. Alice Submitted');
          expect(row.getCell(6).value).toBe('Submitted');
          expect(row.getCell(8).value).toBe('AA-EXP');
        }
      });
      expect(foundInSheet1).toBe(true);

      let foundInSheet2 = false;
      sheet2.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && row.getCell(1).value === 'TEST_FAC_NOTSUB_01') {
          foundInSheet2 = true;
          expect(row.getCell(2).value).toBe('Prof. Bob NotSubmitted');
          expect(row.getCell(6).value).toBe('Not Submitted');
        }
      });
      expect(foundInSheet2).toBe(true);

      // Verify no duplicates: TEST_FAC_SUB_01 must NOT appear in sheet2
      let duplicateInSheet2 = false;
      sheet2.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && row.getCell(1).value === 'TEST_FAC_SUB_01') {
          duplicateInSheet2 = true;
        }
      });
      expect(duplicateInSheet2).toBe(false);

      // Verify no duplicates: TEST_FAC_NOTSUB_01 must NOT appear in sheet1
      let duplicateInSheet1 = false;
      sheet1.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && row.getCell(1).value === 'TEST_FAC_NOTSUB_01') {
          duplicateInSheet1 = true;
        }
      });
      expect(duplicateInSheet1).toBe(false);
    });

    test('GET /api/submissions/export?format=csv returns 200 with combined tabular data', async () => {
      const res = await request(app)
        .get('/api/submissions/export')
        .query({
          format: 'csv',
          academicYear: '2026-2027',
          semester: 'ODD'
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Employee ID,Faculty Name,Designation,Email,Mobile Number,Submission Status');
      expect(res.text).toContain('TEST_FAC_SUB_01');
      expect(res.text).toContain('TEST_FAC_NOTSUB_01');
    });
  });
});
