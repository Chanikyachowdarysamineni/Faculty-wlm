'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

const { signToken } = require('../../src/utils/jwt');
const workloadsRouter = require('../../src/routes/workloads');
const allocationsRouter = require('../../src/routes/allocations');
const Course = require('../../src/models/Course');
const Faculty = require('../../src/models/Faculty');
const User = require('../../src/models/User');
const Workload = require('../../src/models/Workload');
const CourseAllocation = require('../../src/models/CourseAllocation');
const Setting = require('../../src/models/Setting');
const AcademicYear = require('../../src/models/AcademicYear');
const AcademicYearSemester = require('../../src/models/AcademicYearSemester');

const app = express();
app.use(express.json());
app.use('/deva/workloads', workloadsRouter);
app.use('/deva/allocations', allocationsRouter);

jest.setTimeout(30000);

describe('Workload Assignment Fixes and Data Consistency Tests', () => {
  const FACULTY_1 = 'TEST_WL_FAC_1';
  const FACULTY_2 = 'TEST_WL_FAC_2';
  const TA_FACULTY = 'TEST_WL_TA_1';
  const ADMIN_ID = 'ADMIN_WL_FIX_99';
  const ACADEMIC_YEAR = '2026-2027';
  const SEMESTER = 'ODD';

  let adminToken;
  let facultyToken;
  let originalSettingDoc = null;

  const TEST_COURSE_1 = {
    courseId: 91001,
    subjectCode: '26CS301',
    subjectName: 'Advanced Web Engineering',
    shortName: 'AWE',
    year: 'III',
    courseType: 'Mandatory',
    program: 'B.Tech',
    L: 2, T: 0, P: 2, C: 3,
    academicYear: ACADEMIC_YEAR,
    semester: SEMESTER,
  };

  const TEST_COURSE_DE = {
    courseId: 91002,
    subjectCode: '26CS401',
    subjectName: 'Artificial Intelligence Elective',
    shortName: 'AIE',
    year: 'III',
    courseType: 'Department Elective',
    program: 'B.Tech',
    L: 3, T: 0, P: 0, C: 3,
    academicYear: ACADEMIC_YEAR,
    semester: SEMESTER,
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Cleanup
    await Course.deleteMany({ courseId: { $in: [91001, 91002] } });
    await Faculty.deleteMany({ empId: { $in: [FACULTY_1, FACULTY_2, TA_FACULTY, ADMIN_ID] } });
    await User.deleteMany({ empId: { $in: [FACULTY_1, FACULTY_2, TA_FACULTY, ADMIN_ID] } });
    await Workload.deleteMany({ empId: { $in: [FACULTY_1, FACULTY_2, TA_FACULTY, ADMIN_ID] } });
    await CourseAllocation.deleteMany({ courseId: { $in: [91001, 91002] } });

    // Setup Academic Period
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

    // Setup Users & Tokens
    await User.create([
      { empId: ADMIN_ID, role: 'admin', name: 'Admin WL Fix', email: 'admin.wlfix@vignan.ac.in', passwordHash: 'hash', tokenVersion: 0 },
      { empId: FACULTY_1, role: 'faculty', name: 'Dr. Faculty One', email: 'fac1@vignan.ac.in', passwordHash: 'hash', tokenVersion: 0 },
      { empId: FACULTY_2, role: 'faculty', name: 'Dr. Faculty Two', email: 'fac2@vignan.ac.in', passwordHash: 'hash', tokenVersion: 0 },
      { empId: TA_FACULTY, role: 'faculty', name: 'Mr. TA Scholar', email: 'ta1@vignan.ac.in', passwordHash: 'hash', tokenVersion: 0 },
    ]);

    adminToken = signToken({ id: ADMIN_ID, role: 'admin', empId: ADMIN_ID });
    facultyToken = signToken({ id: FACULTY_1, role: 'faculty', empId: FACULTY_1 });

    // Setup Faculty
    await Faculty.create([
      { empId: FACULTY_1, name: 'Dr. Faculty One', designation: 'Professor', department: 'CSE', email: 'fac1@vignan.ac.in', mobile: '9900011111', capacity: 18 },
      { empId: FACULTY_2, name: 'Dr. Faculty Two', designation: 'Associate Professor', department: 'CSE', email: 'fac2@vignan.ac.in', mobile: '9900022222', capacity: 16 },
      { empId: TA_FACULTY, name: 'Mr. TA Scholar', designation: 'Teaching Assistant', department: 'CSE', email: 'ta1@vignan.ac.in', mobile: '9900033333', capacity: 18 },
    ]);

    // Setup Courses
    await Course.insertMany([TEST_COURSE_1, TEST_COURSE_DE]);

    // Backup original Section Config before test
    originalSettingDoc = await Setting.findOne({ key: `sections_config_${ACADEMIC_YEAR}_${SEMESTER}` }).lean();

    // Setup Section Config for test
    await Setting.findOneAndUpdate(
      { key: `sections_config_${ACADEMIC_YEAR}_${SEMESTER}` },
      { key: `sections_config_${ACADEMIC_YEAR}_${SEMESTER}`, value: JSON.stringify({ III: ['1', '2', '3'] }) },
      { upsert: true, new: true }
    );
  });

  afterAll(async () => {
    // Restore original Section Config after test completes
    if (originalSettingDoc) {
      await Setting.findOneAndUpdate(
        { key: `sections_config_${ACADEMIC_YEAR}_${SEMESTER}` },
        { value: originalSettingDoc.value },
        { upsert: true }
      );
    }
    await Course.deleteMany({ courseId: { $in: [91001, 91002] } });
    await Faculty.deleteMany({ empId: { $in: [FACULTY_1, FACULTY_2, TA_FACULTY, ADMIN_ID] } });
    await User.deleteMany({ empId: { $in: [FACULTY_1, FACULTY_2, TA_FACULTY, ADMIN_ID] } });
    await Workload.deleteMany({ empId: { $in: [FACULTY_1, FACULTY_2, TA_FACULTY, ADMIN_ID] } });
    await CourseAllocation.deleteMany({ courseId: { $in: [91001, 91002] } });
  });

  describe('Issue 2: Undefined Faculty Capacity & Faculty Hours API', () => {
    it('returns unnested capacity and target alias from GET /faculty-hours/:empId', async () => {
      const res = await request(app)
        .get(`/deva/workloads/faculty-hours/${FACULTY_1}?semester=${SEMESTER}&academicYear=${ACADEMIC_YEAR}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Validate that data is not double-nested
      expect(res.body.data).toBeDefined();
      expect(res.body.data.data).toBeUndefined(); // MUST NOT have data.data
      expect(res.body.data.capacity).toBe(18);
      expect(res.body.data.target).toBe(18); // target alias present
      expect(res.body.data.currentLoad).toBe(0);
      expect(res.body.data.remaining).toBe(18);
      expect(res.body.data.remainingHours).toBe(18); // remainingHours alias present
      expect(res.body.data.utilizationPercent).toBe(0); // utilizationPercent alias present
    });
  });

  describe('Issue 1: Workload Assignment and False Duplicate Validation', () => {
    it('successfully assigns workload to faculty for the first time', async () => {
      const payload = {
        empId: FACULTY_1,
        courseId: TEST_COURSE_1.courseId,
        facultyRole: 'Main Faculty',
        year: 'III',
        section: '1',
        manualL: 2,
        manualT: 0,
        manualP: 2,
        academicYear: ACADEMIC_YEAR,
        semester: SEMESTER,
      };

      const res = await request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.empId).toBe(FACULTY_1);
      expect(res.body.data.manualL).toBe(2);
      expect(res.body.data.manualP).toBe(2);
    });

    it('updates existing assignment when the SAME faculty re-assigns/updates hours (no 409 conflict)', async () => {
      const updatePayload = {
        empId: FACULTY_1,
        courseId: TEST_COURSE_1.courseId,
        facultyRole: 'Main Faculty',
        year: 'III',
        section: '1',
        manualL: 2,
        manualT: 1, // updated tutorial hours
        manualP: 2,
        academicYear: ACADEMIC_YEAR,
        semester: SEMESTER,
      };

      const res = await request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePayload);

      // Must succeed (200 OK) without false 409 duplicate error
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.manualT).toBe(1);

      // Verify in DB that only 1 record exists with updated hours
      const records = await Workload.find({
        empId: FACULTY_1,
        courseId: TEST_COURSE_1.courseId,
        year: 'III',
        section: '1',
        academicYear: ACADEMIC_YEAR,
        semester: SEMESTER,
        isDeleted: { $ne: true }
      });
      expect(records.length).toBe(1);
      expect(records[0].manualT).toBe(1);
    });

    it('returns 409 Conflict with informative message when DIFFERENT faculty tries to take Main Faculty', async () => {
      const conflictPayload = {
        empId: FACULTY_2,
        courseId: TEST_COURSE_1.courseId,
        facultyRole: 'Main Faculty',
        year: 'III',
        section: '1',
        manualL: 2,
        manualT: 0,
        manualP: 2,
        academicYear: ACADEMIC_YEAR,
        semester: SEMESTER,
      };

      const res = await request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(conflictPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already allocated to');
      expect(res.body.message).toContain('Dr. Faculty One');
    });
  });

  describe('Issue 3: TA Assignment and Lecture Hours Restriction', () => {
    it('restricts TA manualL to 0 even if non-zero manualL is submitted', async () => {
      const taPayload = {
        empId: TA_FACULTY,
        courseId: TEST_COURSE_1.courseId,
        facultyRole: 'TA',
        allocationRow: 1, // R2
        year: 'III',
        section: '1',
        manualL: 2, // TA should NOT get lecture hours
        manualT: 0,
        manualP: 2,
        academicYear: ACADEMIC_YEAR,
        semester: SEMESTER,
      };

      const res = await request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(taPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // manualL must be strictly 0 for TA
      expect(res.body.data.manualL).toBe(0);
      expect(res.body.data.manualP).toBe(2);

      // Verify faculty hours calculation for TA reflects 0 lecture hours
      const hoursRes = await request(app)
        .get(`/deva/workloads/faculty-hours/${TA_FACULTY}?semester=${SEMESTER}&academicYear=${ACADEMIC_YEAR}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(hoursRes.status).toBe(200);
      // TA currentLoad should be 2 (0 + 0 + 2), NOT 4
      expect(hoursRes.body.data.currentLoad).toBe(2);
      expect(hoursRes.body.data.breakdown.lectureHours).toBe(0);
      expect(hoursRes.body.data.breakdown.practicalHours).toBe(2);
    });
  });

  describe('Issue 4: Allocation Lookup and Bidirectional Sync', () => {
    it('syncs workload assignment to CourseAllocation with academicYear and semester', async () => {
      const allocation = await CourseAllocation.findOne({
        courseId: TEST_COURSE_1.courseId,
        year: 'III',
        section: '1',
        academicYear: ACADEMIC_YEAR,
        semester: SEMESTER,
      }).lean();

      expect(allocation).toBeDefined();
      expect(allocation.lectureSlot?.empId).toBe(FACULTY_1);
      expect(allocation.academicYear).toBe(ACADEMIC_YEAR);
      expect(allocation.semester).toBe(SEMESTER);
      // TA slot 1 (R2) should be synced
      expect(allocation.practicalSlots[1]?.empId).toBe(TA_FACULTY);
    });

    it('retrieves allocation through GET /allocations with academicYear and semester query parameters', async () => {
      const res = await request(app)
        .get(`/deva/allocations?courseId=${TEST_COURSE_1.courseId}&year=III&section=1&academicYear=${ACADEMIC_YEAR}&semester=${SEMESTER}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].courseId).toBe(TEST_COURSE_1.courseId);
      expect(res.body.data[0].lectureSlot?.empId).toBe(FACULTY_1);
    });
  });

  describe('Comprehensive Scenarios: Multi-Section, Period Isolation, Fallback Capacity & Concurrency', () => {
    it('allows assigning the same course to a different section without conflict', async () => {
      const res = await request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          empId: FACULTY_2,
          courseId: TEST_COURSE_1.courseId,
          facultyRole: 'Main Faculty',
          year: 'III',
          section: '2', // Different section
          manualL: 2,
          manualT: 0,
          manualP: 2,
          academicYear: ACADEMIC_YEAR,
          semester: SEMESTER,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.section).toBe('2');
    });

    it('allows assigning the same course and section in a DIFFERENT academic year/semester without conflict', async () => {
      const res = await request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          empId: FACULTY_2,
          courseId: TEST_COURSE_1.courseId,
          facultyRole: 'Main Faculty',
          year: 'III',
          section: '1',
          manualL: 2,
          manualT: 0,
          manualP: 2,
          academicYear: '2027-2028', // Different academic year
          semester: 'ODD',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.academicYear).toBe('2027-2028');
      expect(res.body.data.semester).toBe('ODD');
    });

    it('dynamically falls back to default capacity when faculty has no capacity set in DB', async () => {
      const NO_CAP_FACULTY = 'TEST_WL_NO_CAP';
      await Faculty.deleteMany({ empId: NO_CAP_FACULTY });
      await Faculty.create({
        empId: NO_CAP_FACULTY,
        name: 'Prof. No Explicit Cap',
        designation: 'Assistant Professor',
        department: 'CSE',
        email: 'nocap@vignan.ac.in',
        mobile: '9888877777',
        // capacity intentionally omitted
      });

      const res = await request(app)
        .get(`/deva/workloads/faculty-hours/${NO_CAP_FACULTY}?semester=${SEMESTER}&academicYear=${ACADEMIC_YEAR}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Faculty default capacity is 18
      expect(res.body.data.capacity).toBe(18);
      expect(res.body.data.target).toBe(18);
      expect(res.body.data.currentLoad).toBe(0);
      expect(res.body.data.remaining).toBe(18);

      await Faculty.deleteMany({ empId: NO_CAP_FACULTY });
    });

    it('handles concurrent assignment requests safely', async () => {
      // Simulate two administrators attempting to allocate Main Faculty for section '3' at the exact same instant
      const req1 = request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          empId: FACULTY_1,
          courseId: TEST_COURSE_1.courseId,
          facultyRole: 'Main Faculty',
          year: 'III',
          section: '3',
          manualL: 2,
          manualT: 0,
          manualP: 2,
          academicYear: ACADEMIC_YEAR,
          semester: SEMESTER,
        });

      const req2 = request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          empId: FACULTY_2,
          courseId: TEST_COURSE_1.courseId,
          facultyRole: 'Main Faculty',
          year: 'III',
          section: '3',
          manualL: 2,
          manualT: 0,
          manualP: 2,
          academicYear: ACADEMIC_YEAR,
          semester: SEMESTER,
        });

      const [res1, res2] = await Promise.all([req1, req2]);
      const statuses = [res1.status, res2.status].sort();

      // Exactly one request must succeed (201) and the competing request must be rejected (409 Conflict)
      expect(statuses).toEqual([201, 409]);

      // Exactly 1 allocation record must exist in DB for section 3
      const count = await Workload.countDocuments({
        courseId: TEST_COURSE_1.courseId,
        year: 'III',
        section: '3',
        facultyRole: 'Main Faculty',
        academicYear: ACADEMIC_YEAR,
        semester: SEMESTER,
        isDeleted: { $ne: true }
      });
      expect(count).toBe(1);
    });
  });
});

