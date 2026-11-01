'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const submissionsRouter = require('../../src/routes/submissions');
const User = require('../../src/models/User');
const Faculty = require('../../src/models/Faculty');
const Course = require('../../src/models/Course');
const Submission = require('../../src/models/Submission');
const AcademicYear = require('../../src/models/AcademicYear');
const AcademicYearSemester = require('../../src/models/AcademicYearSemester');
const { signToken } = require('../../src/utils/jwt');

const app = express();
app.use(express.json());
app.use('/api/submissions', submissionsRouter);

describe('Faculty Preference Analysis Unit & Integration Tests', () => {
  let adminToken;
  let userToken;
  let testAy;
  let testSem;
  let testCourse1;
  let testCourse2;
  let testFaculty1;
  let testFaculty2;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    testAy = await AcademicYear.findOne({ name: '2026-2027' }).lean() || await AcademicYear.findOne({}).lean();
    testSem = await AcademicYearSemester.findOne({ academicYearId: testAy._id, semesterType: 'EVEN' }).lean()
      || await AcademicYearSemester.findOne({ semesterType: 'EVEN' }).lean();

    // Create test admin user if needed
    let admin = await User.findOne({ role: 'admin', isDeleted: { $ne: true } }).lean();
    if (!admin) {
      admin = await User.create({
        empId: 'TEST_PREF_ADMIN',
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

    userToken = signToken({
      id: 'REGULAR_USER_99',
      empId: 'REGULAR_USER_99',
      role: 'faculty',
      canAccessAdmin: false,
      tokenVersion: 0
    });
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
  }, 30000);

  test('1. Security: rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/submissions/preference-analysis');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('2. Security: rejects non-admin users with 403', async () => {
    const res = await request(app)
      .get('/api/submissions/preference-analysis')
      .set('Authorization', `Bearer ${userToken}`);
    expect([401, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  test('3. Fetches dynamic courses and preference summary for academic period', async () => {
    const res = await request(app)
      .get('/api/submissions/preference-analysis')
      .query({
        academicYear: '2026-2027',
        semester: 'EVEN'
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const data = res.body.data;
    expect(data.academicYear).toBe('2026-2027');
    expect(data.semester).toBe('EVEN');
    expect(Array.isArray(data.courses)).toBe(true);
    expect(data.courses.length).toBeGreaterThan(0);

    // Verify course structure
    const firstCourse = data.courses[0];
    expect(firstCourse).toHaveProperty('courseId');
    expect(firstCourse).toHaveProperty('subjectCode');
    expect(firstCourse).toHaveProperty('subjectName');
    expect(firstCourse).toHaveProperty('counts');
    expect(firstCourse.counts).toHaveProperty('pref1');
    expect(firstCourse.counts).toHaveProperty('pref2');
    expect(firstCourse.counts).toHaveProperty('pref3');
    expect(firstCourse.counts).toHaveProperty('pref4');
    expect(firstCourse.counts).toHaveProperty('pref5');
    expect(firstCourse.counts).toHaveProperty('total');
  });

  test('4. Correctly filters by courseId and preferenceLevel 1', async () => {
    const listRes = await request(app)
      .get('/api/submissions/preference-analysis')
      .query({ academicYear: '2026-2027', semester: 'EVEN' })
      .set('Authorization', `Bearer ${adminToken}`);

    const targetCourse = listRes.body.data.courses[0];
    expect(targetCourse).toBeDefined();

    const res = await request(app)
      .get('/api/submissions/preference-analysis')
      .query({
        academicYear: '2026-2027',
        semester: 'EVEN',
        courseId: targetCourse.courseId,
        preferenceLevel: 1
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.summary.counts.pref1).toBe(targetCourse.counts.pref1);
    expect(data.matchingFacultyCount).toBe(targetCourse.counts.pref1);

    // Verify matching faculty properties
    if (data.faculty.length > 0) {
      const fac = data.faculty[0];
      expect(fac).toHaveProperty('empId');
      expect(fac).toHaveProperty('empName');
      expect(fac).toHaveProperty('designation');
      expect(fac).toHaveProperty('courseId', targetCourse.courseId);
      expect(fac).toHaveProperty('preferenceLevel', 1);
    }
  });

  test('5. Supports preferenceLevel 2, 3, 4, 5 counts matching breakdown', async () => {
    const listRes = await request(app)
      .get('/api/submissions/preference-analysis')
      .query({ academicYear: '2026-2027', semester: 'EVEN' })
      .set('Authorization', `Bearer ${adminToken}`);

    const targetCourse = listRes.body.data.courses[0];

    for (let lvl = 2; lvl <= 5; lvl++) {
      const res = await request(app)
        .get('/api/submissions/preference-analysis')
        .query({
          academicYear: '2026-2027',
          semester: 'EVEN',
          courseId: targetCourse.courseId,
          preferenceLevel: lvl
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.matchingFacultyCount).toBe(targetCourse.counts[`pref${lvl}`]);
    }
  });

  test('6. Exports preference analysis as CSV', async () => {
    const res = await request(app)
      .get('/api/submissions/preference-analysis')
      .query({
        academicYear: '2026-2027',
        semester: 'EVEN',
        preferenceLevel: 1,
        format: 'csv'
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="preference_analysis_.*\.csv"/);
    expect(res.text).toContain('Employee ID');
    expect(res.text).toContain('Faculty Name');
    expect(res.text).toContain('Preference Level');
  });

  test('7. Exports preference analysis as Excel (.xlsx)', async () => {
    const res = await request(app)
      .get('/api/submissions/preference-analysis')
      .query({
        academicYear: '2026-2027',
        semester: 'EVEN',
        preferenceLevel: 1,
        format: 'excel'
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="preference_analysis_.*\.xlsx"/);
    expect(res.body).toBeDefined();
  });
});

