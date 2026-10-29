'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

const { normalizeYear, deriveYearFromCode, resolveCourseYear } = require('../../src/utils/courseUtils');
const { signToken } = require('../../src/utils/jwt');
const facultyPreferencesRouter = require('../../src/routes/faculty-preferences');
const workloadsRouter = require('../../src/routes/workloads');
const Course = require('../../src/models/Course');
const Faculty = require('../../src/models/Faculty');
const User = require('../../src/models/User');
const Submission = require('../../src/models/Submission');
const Workload = require('../../src/models/Workload');
const FacultyPreference = require('../../src/models/FacultyPreference');
const Setting = require('../../src/models/Setting');
const AcademicYear = require('../../src/models/AcademicYear');
const AcademicYearSemester = require('../../src/models/AcademicYearSemester');

const app = express();
app.use(express.json());

app.use('/deva/faculty-preferences', facultyPreferencesRouter);
app.use('/deva/workloads', workloadsRouter);

describe('Course Year Fetching and Workload Assignment System', () => {
  const TEST_EMP_ID = 'TEST_FAC_CY_99';
  const ADMIN_EMP_ID = 'ADMIN_CY_99';
  const ACADEMIC_YEAR = '2025-2026';
  const SEMESTER = 'ODD';

  let adminToken;
  let facultyToken;

  const TEST_COURSES = [
    {
      courseId: 90001,
      subjectCode: '25CS301',
      subjectName: 'Design and Analysis of Algorithms',
      shortName: 'DAA',
      year: 'III',
      courseType: 'Mandatory',
      program: 'B.Tech',
      L: 3, T: 1, P: 0, C: 4,
      academicYear: ACADEMIC_YEAR,
      semester: SEMESTER,
    },
    {
      courseId: 90002,
      subjectCode: '25CS201',
      subjectName: 'Data Structures and Algorithms',
      shortName: 'DSA',
      year: '', // intentionally empty to test dynamic derivation from subject code
      courseType: 'Mandatory',
      program: 'B.Tech',
      L: 3, T: 0, P: 2, C: 4,
      academicYear: ACADEMIC_YEAR,
      semester: SEMESTER,
    },
    {
      courseId: 90003,
      subjectCode: '25CS401',
      subjectName: 'Cloud Computing and Virtualization',
      shortName: 'CCV',
      year: '4', // numeric to test canonical normalization to 'IV'
      courseType: 'Department Elective',
      program: 'B.Tech',
      L: 3, T: 0, P: 0, C: 3,
      academicYear: ACADEMIC_YEAR,
      semester: SEMESTER,
    },
    {
      courseId: 90004,
      subjectCode: '25CSM101',
      subjectName: 'Advanced Computer Architecture',
      shortName: 'ACA',
      year: 'M.Tech_I',
      courseType: 'Mandatory',
      program: 'M.Tech',
      L: 3, T: 1, P: 0, C: 4,
      academicYear: ACADEMIC_YEAR,
      semester: SEMESTER,
    },
  ];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Cleanup existing test records
    await Course.deleteMany({ courseId: { $in: [90001, 90002, 90003, 90004] } });
    await Faculty.deleteMany({ empId: { $in: [TEST_EMP_ID, ADMIN_EMP_ID] } });
    await User.deleteMany({ empId: { $in: [TEST_EMP_ID, ADMIN_EMP_ID] } });
    await Submission.deleteMany({ empId: { $in: [TEST_EMP_ID, ADMIN_EMP_ID] } });
    await Workload.deleteMany({ empId: { $in: [TEST_EMP_ID, ADMIN_EMP_ID] } });
    await FacultyPreference.deleteMany({ empId: { $in: [TEST_EMP_ID, ADMIN_EMP_ID] } });

    // Setup Academic Year and Semester in DB
    const ay = await AcademicYear.findOneAndUpdate(
      { name: ACADEMIC_YEAR },
      { name: ACADEMIC_YEAR, isCurrent: true, status: 'ACTIVE' },
      { upsert: true, new: true }
    );

    await AcademicYearSemester.findOneAndUpdate(
      { academicYearId: ay._id, semesterType: SEMESTER },
      { academicYearId: ay._id, semesterType: SEMESTER, status: 'ACTIVE' },
      { upsert: true, new: true }
    );

    await User.create([
      { empId: ADMIN_EMP_ID, role: 'admin', name: 'Admin CY', email: 'admin.cy@vignan.ac.in', passwordHash: 'dummyhash', tokenVersion: 0 },
      { empId: TEST_EMP_ID, role: 'faculty', name: 'Dr. Test Preference Faculty', email: 'test.cy.faculty@vignan.ac.in', passwordHash: 'dummyhash', tokenVersion: 0 },
    ]);

    adminToken = signToken({ id: ADMIN_EMP_ID, role: 'admin', empId: ADMIN_EMP_ID });
    facultyToken = signToken({ id: TEST_EMP_ID, role: 'faculty', empId: TEST_EMP_ID });

    // Insert test courses
    await Course.insertMany(TEST_COURSES);

    // Insert test faculty
    await Faculty.create({
      empId: TEST_EMP_ID,
      name: 'Dr. Test Preference Faculty',
      designation: 'Associate Professor',
      department: 'CSE',
      email: 'test.cy.faculty@vignan.ac.in',
      mobile: '9876543210',
      capacity: 18,
    });

    // Ensure Section settings exist for test
    await Setting.findOneAndUpdate(
      { key: `sections_config_${ACADEMIC_YEAR}_${SEMESTER}` },
      {
        key: `sections_config_${ACADEMIC_YEAR}_${SEMESTER}`,
        value: JSON.stringify({
          'I': ['1', '2'],
          'II': ['1', '2'],
          'III': ['1', '2'],
          'IV': ['1', '2'],
          'M.Tech_I': ['1'],
          'M.Tech_II': ['1']
        })
      },
      { upsert: true }
    );
  });

  afterAll(async () => {
    await Course.deleteMany({ courseId: { $in: [90001, 90002, 90003, 90004] } });
    await Faculty.deleteMany({ empId: { $in: [TEST_EMP_ID, ADMIN_EMP_ID] } });
    await User.deleteMany({ empId: { $in: [TEST_EMP_ID, ADMIN_EMP_ID] } });
    await Submission.deleteMany({ empId: { $in: [TEST_EMP_ID, ADMIN_EMP_ID] } });
    await Workload.deleteMany({ empId: { $in: [TEST_EMP_ID, ADMIN_EMP_ID] } });
    await FacultyPreference.deleteMany({ empId: { $in: [TEST_EMP_ID, ADMIN_EMP_ID] } });
  });

  describe('1. Dynamic Year Normalization & Derivation Utility', () => {
    test('normalizeYear handles numeric, Roman numerals, and M.Tech formats', () => {
      expect(normalizeYear('1')).toBe('I');
      expect(normalizeYear('2')).toBe('II');
      expect(normalizeYear('3')).toBe('III');
      expect(normalizeYear('4')).toBe('IV');
      expect(normalizeYear('1st Year')).toBe('I');
      expect(normalizeYear('2nd Year')).toBe('II');
      expect(normalizeYear('3rd Year')).toBe('III');
      expect(normalizeYear('4th Year')).toBe('IV');
      expect(normalizeYear('M.Tech_I')).toBe('M.Tech_I');
      expect(normalizeYear('MTECH_I')).toBe('M.Tech_I');
      expect(normalizeYear('M.Tech 1')).toBe('M.Tech_I');
      expect(normalizeYear('M.Tech_II')).toBe('M.Tech_II');
    });

    test('deriveYearFromCode extracts year from subject code patterns', () => {
      expect(deriveYearFromCode('25CS101')).toBe('I');
      expect(deriveYearFromCode('25CS201')).toBe('II');
      expect(deriveYearFromCode('25CS301')).toBe('III');
      expect(deriveYearFromCode('25CS401')).toBe('IV');
      expect(deriveYearFromCode('CS101')).toBe('I');
      expect(deriveYearFromCode('CS201')).toBe('II');
      expect(deriveYearFromCode('CSE301')).toBe('III');
      expect(deriveYearFromCode('MATH-II')).toBe('II');
      expect(deriveYearFromCode('PHYSICS I')).toBe('I');
    });

    test('resolveCourseYear prioritizes explicit normalized year and falls back to code derivation', () => {
      // Explicit Roman year
      expect(resolveCourseYear({ year: 'III', subjectCode: '25CS101' })).toBe('III');
      // Explicit numeric year normalized
      expect(resolveCourseYear({ year: '2', subjectCode: '25CS101' })).toBe('II');
      // Empty year derived from code
      expect(resolveCourseYear({ year: '', subjectCode: '25CS301' })).toBe('III');
      // Null year derived from code
      expect(resolveCourseYear({ year: null, subjectCode: '25CS201' })).toBe('II');
      // M.Tech year
      expect(resolveCourseYear({ year: 'M.Tech_I', subjectCode: '25CSM101' })).toBe('M.Tech_I');
    });
  });

  describe('2. Preference Submission and Scoped Course Year Fetching', () => {
    test('returns empty preferences before submission (no 404)', async () => {
      const res = await request(app)
        .get(`/deva/faculty-preferences/${TEST_EMP_ID}?semester=${SEMESTER}&academicYear=${ACADEMIC_YEAR}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isSubmitted).toBe(false);
      expect(res.body.data.preferredCourseIds).toEqual([]);
    });

    test('submits faculty preferences with courses across different study years', async () => {
      const submission = await Submission.create({
        empId: TEST_EMP_ID,
        empName: 'Dr. Test Preference Faculty',
        designation: 'Associate Professor',
        mobile: '9876543210',
        prefs: [90001, 90002, 90003, 90004], // Years: III, II (derived), IV (normalized), M.Tech_I
        semester: SEMESTER,
        academicYear: ACADEMIC_YEAR,
      });

      expect(submission).toBeDefined();
      expect(submission.prefs.length).toBe(4);
    });

    test('GET /deva/faculty-preferences/:empId returns preferredCourseIds AND resolved preferredCourses with exact years', async () => {
      const res = await request(app)
        .get(`/deva/faculty-preferences/${TEST_EMP_ID}?semester=${SEMESTER}&academicYear=${ACADEMIC_YEAR}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isSubmitted).toBe(true);
      expect(res.body.data.preferredCourseIds).toEqual([90001, 90002, 90003, 90004]);

      const courses = res.body.data.preferredCourses;
      expect(courses).toBeDefined();
      expect(courses.length).toBe(4);

      // Verify each course has its dynamically resolved study year
      const course90001 = courses.find((c) => c.courseId === 90001);
      expect(course90001.year).toBe('III');

      const course90002 = courses.find((c) => c.courseId === 90002);
      expect(course90002.year).toBe('II'); // Derived from 25CS201

      const course90003 = courses.find((c) => c.courseId === 90003);
      expect(course90003.year).toBe('IV'); // Normalized from '4'

      const course90004 = courses.find((c) => c.courseId === 90004);
      expect(course90004.year).toBe('M.Tech_I');
    });

    test('GET /deva/faculty-preferences/:empId/courses returns filtered preferred courses with resolved years', async () => {
      const res = await request(app)
        .get(`/deva/faculty-preferences/${TEST_EMP_ID}/courses?semester=${SEMESTER}&academicYear=${ACADEMIC_YEAR}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasPreferences).toBe(true);
      expect(res.body.data.courses.length).toBe(4);

      // All returned courses have non-empty resolved year
      res.body.data.courses.forEach((c) => {
        expect(c.year).toBeTruthy();
        expect(['I', 'II', 'III', 'IV', 'M.Tech_I', 'M.Tech_II']).toContain(c.year);
      });
    });

    test('querying for different semester returns unsubmitted if faculty only submitted for ODD', async () => {
      const res = await request(app)
        .get(`/deva/faculty-preferences/${TEST_EMP_ID}?semester=EVEN&academicYear=${ACADEMIC_YEAR}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isSubmitted).toBe(false);
      expect(res.body.data.preferredCourseIds).toEqual([]);
    });
  });

  describe('3. Workload Assignment Year Validation & Integration', () => {
    test('successfully assigns workload when course year matches assignment year (Year III)', async () => {
      const res = await request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-academic-year', ACADEMIC_YEAR)
        .set('x-semester', SEMESTER)
        .send({
          empId: TEST_EMP_ID,
          courseId: 90001, // 25CS301 is Year III
          year: 'III',
          section: '1',
          facultyRole: 'Main Faculty',
          manualL: 3,
          manualT: 1,
          manualP: 0,
        });

      if (res.status !== 201) console.log('ERROR BODY:', res.body);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.courseId).toBe(90001);
      expect(res.body.data.year).toBe('III');
    });

    test('rejects workload assignment when submitted year mismatches the course year', async () => {
      const res = await request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-academic-year', ACADEMIC_YEAR)
        .set('x-semester', SEMESTER)
        .send({
          empId: TEST_EMP_ID,
          courseId: 90001, // 25CS301 is Year III
          year: 'I', // mismatched year
          section: '1',
          facultyRole: 'Main Faculty',
          manualL: 3,
          manualT: 1,
          manualP: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/is for Year III, but you selected Year I/i);
    });

    test('successfully assigns course where year was derived from course code (25CS201 -> Year II)', async () => {
      const res = await request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-academic-year', ACADEMIC_YEAR)
        .set('x-semester', SEMESTER)
        .send({
          empId: TEST_EMP_ID,
          courseId: 90002, // 25CS201 has empty year in DB, resolves to II
          year: 'II',
          section: '2',
          facultyRole: 'Main Faculty',
          manualL: 3,
          manualT: 0,
          manualP: 2,
        });

      if (res.status !== 201) console.log('ERROR BODY:', res.body);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.courseId).toBe(90002);
      expect(res.body.data.year).toBe('II');
    });
  });
});
