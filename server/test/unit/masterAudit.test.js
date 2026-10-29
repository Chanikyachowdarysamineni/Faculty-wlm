'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

const { signToken } = require('../../src/utils/jwt');
const coursesRouter = require('../../src/routes/courses');
const designationsRouter = require('../../src/routes/designations');
const workloadsRouter = require('../../src/routes/workloads');
const statsRouter = require('../../src/routes/stats');

const Course = require('../../src/models/Course');
const Designation = require('../../src/models/Designation');
const Faculty = require('../../src/models/Faculty');
const User = require('../../src/models/User');
const Workload = require('../../src/models/Workload');
const CourseAllocation = require('../../src/models/CourseAllocation');
const AcademicYear = require('../../src/models/AcademicYear');
const AcademicYearSemester = require('../../src/models/AcademicYearSemester');

const app = express();
app.use(express.json());
app.use('/deva/courses', coursesRouter);
app.use('/deva/designations', designationsRouter);
app.use('/deva/workloads', workloadsRouter);
app.use('/deva/stats', statsRouter);

jest.setTimeout(30000);

describe('Master System Audit, Reliability & Security Verification', () => {
  const ADMIN_ID = 'MA_ADMIN_99';
  const FAC_ACTIVE = 'MA_FAC_ACTIVE';
  const FAC_RELIEVED = 'MA_FAC_RELIEVED';
  const FAC_DELETED = 'MA_FAC_DELETED';
  const TA_FAC = 'MA_TA_FAC';

  const AY_ACTIVE = '2026-2027';
  const AY_FUTURE = '2027-2028';
  const SEM = 'ODD';

  let adminToken;
  let academicYearDoc;
  let semesterDoc;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    }

    adminToken = signToken({ id: ADMIN_ID, role: 'admin', empId: ADMIN_ID, permissions: ['ALL'] });

    // Ensure active academic year and semester exist
    academicYearDoc = await AcademicYear.findOneAndUpdate(
      { name: AY_ACTIVE },
      {
        $set: {
          name: AY_ACTIVE,
          startDate: new Date('2026-06-01'),
          endDate: new Date('2027-05-31'),
          isCurrent: true,
          status: 'ACTIVE',
        },
      },
      { upsert: true, new: true }
    );

    semesterDoc = await AcademicYearSemester.findOneAndUpdate(
      { academicYearId: academicYearDoc._id, semesterType: SEM },
      {
        $set: {
          academicYearId: academicYearDoc._id,
          academicYear: AY_ACTIVE,
          semesterType: SEM,
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-11-30'),
          status: 'ACTIVE',
        },
      },
      { upsert: true, new: true }
    );

    // Clean up test data before running
    await Course.deleteMany({ subjectCode: { $in: ['MA_CS101', 'MA_CS102', 'MA_CS103'] } });
    await Designation.deleteMany({ name: { $in: ['Audit Specialist', 'Audit Specialist Duplicate', 'Specialist Lead'] } });
    await Workload.deleteMany({ empId: { $in: [FAC_ACTIVE, FAC_RELIEVED, FAC_DELETED, TA_FAC] } });
    await CourseAllocation.deleteMany({ 'lectureSlots.empId': { $in: [FAC_ACTIVE, TA_FAC] } });
    await CourseAllocation.deleteMany({ 'practicalSlots.empId': { $in: [FAC_ACTIVE, TA_FAC] } });
    await Faculty.deleteMany({ empId: { $in: [FAC_ACTIVE, FAC_RELIEVED, FAC_DELETED, TA_FAC] } });
    await User.deleteMany({ empId: { $in: [ADMIN_ID, FAC_ACTIVE, FAC_RELIEVED, FAC_DELETED, TA_FAC] } });

    await Faculty.create([
      {
        empId: FAC_ACTIVE,
        name: 'Active Faculty Member',
        designation: 'Professor',
        department: 'CSE',
        mobile: '9876543210',
        email: 'active.fac@univ.edu',
        isDeleted: false,
      },
      {
        empId: FAC_RELIEVED,
        name: 'Relieved Faculty Member',
        designation: 'Assistant Professor',
        department: 'CSE',
        mobile: '9876543211',
        email: 'relieved.fac@univ.edu',
        relievingDate: new Date('2025-01-01'),
        isDeleted: false,
      },
      {
        empId: FAC_DELETED,
        name: 'Soft Deleted Faculty',
        designation: 'Assistant Professor',
        department: 'CSE',
        mobile: '9876543212',
        email: 'deleted.fac@univ.edu',
        isDeleted: true,
      },
      {
        empId: TA_FAC,
        name: 'TA Faculty Member',
        designation: 'Teaching Assistant',
        department: 'CSE',
        mobile: '9876543213',
        email: 'ta.fac@univ.edu',
        isDeleted: false,
      },
    ]);

    await User.create([
      { empId: ADMIN_ID, name: 'Admin', role: 'admin', canAccessAdmin: true, passwordHash: 'dummy_hash_for_test_123' },
      { empId: FAC_ACTIVE, name: 'Active Faculty', role: 'faculty', passwordHash: 'dummy_hash_for_test_123' },
    ]);
  });

  afterAll(async () => {
    await Course.deleteMany({ subjectCode: { $in: ['MA_CS101', 'MA_CS102', 'MA_CS103'] } });
    await Designation.deleteMany({ name: { $in: ['Audit Specialist', 'Audit Specialist Duplicate', 'Specialist Lead'] } });
    await Workload.deleteMany({ empId: { $in: [FAC_ACTIVE, FAC_RELIEVED, FAC_DELETED, TA_FAC] } });
    await CourseAllocation.deleteMany({ courseId: { $in: [99001, 99002, 99003] } });
    await Faculty.deleteMany({ empId: { $in: [FAC_ACTIVE, FAC_RELIEVED, FAC_DELETED, TA_FAC] } });
    await User.deleteMany({ empId: { $in: [ADMIN_ID, FAC_ACTIVE, FAC_RELIEVED, FAC_DELETED, TA_FAC] } });
  });

  describe('Module: Course Management & Conflict Prevention', () => {
    it('1. Should create a course successfully', async () => {
      const res = await request(app)
        .post('/deva/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-academic-year', AY_ACTIVE)
        .set('x-semester', SEM)
        .send({
          subjectCode: 'MA_CS101',
          subjectName: 'Master Audit Systems',
          shortName: 'MAS',
          year: 'III',
          program: 'B.Tech',
          courseType: 'Mandatory',
          L: 3, T: 0, P: 0, C: 3,
          academicYear: AY_ACTIVE,
          semester: SEM,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subjectCode).toBe('MA_CS101');
    });

    it('2. Should reject duplicate course code in the same academic context with 409 Conflict', async () => {
      const res = await request(app)
        .post('/deva/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-academic-year', AY_ACTIVE)
        .set('x-semester', SEM)
        .send({
          subjectCode: 'ma_cs101', // case-insensitive duplicate check
          subjectName: 'Master Audit Systems Duplicate',
          shortName: 'MAS2',
          year: 'III',
          program: 'B.Tech',
          courseType: 'Mandatory',
          L: 3, T: 0, P: 0, C: 3,
          academicYear: AY_ACTIVE,
          semester: SEM,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('3. Should allow same course code in a distinct academic year', async () => {
      const res = await request(app)
        .post('/deva/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-academic-year', AY_FUTURE)
        .set('x-semester', SEM)
        .send({
          subjectCode: 'MA_CS101',
          subjectName: 'Master Audit Systems Next Year',
          shortName: 'MAS',
          year: 'III',
          program: 'B.Tech',
          courseType: 'Mandatory',
          L: 3, T: 0, P: 0, C: 3,
          academicYear: AY_FUTURE,
          semester: SEM,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.academicYear).toBe(AY_FUTURE);
    });

    it('4. Should reject course update (PUT) when renamed to clash with an existing course', async () => {
      // Create second course
      const res2 = await request(app)
        .post('/deva/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-academic-year', AY_ACTIVE)
        .set('x-semester', SEM)
        .send({
          subjectCode: 'MA_CS102',
          subjectName: 'Master Audit Analytics',
          shortName: 'MAA',
          year: 'III',
          program: 'B.Tech',
          courseType: 'Mandatory',
          L: 3, T: 0, P: 0, C: 3,
          academicYear: AY_ACTIVE,
          semester: SEM,
        });

      expect(res2.status).toBe(201);
      const course2Id = res2.body.data.id;

      // Attempt to rename course 2 to MA_CS101
      const updateRes = await request(app)
        .put(`/deva/courses/${course2Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          subjectCode: 'MA_CS101',
        });

      expect(updateRes.status).toBe(409);
      expect(updateRes.body.message).toMatch(/already exists/i);
    });
  });

  describe('Module: Designation Management & Deletion Safety', () => {
    let testDesigId;

    it('1. Should create a new designation successfully', async () => {
      const res = await request(app)
        .post('/deva/designations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Audit Specialist',
          order: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Audit Specialist');
      testDesigId = res.body.data._id;
    });

    it('2. Should reject duplicate designation creation (case-insensitive) with 409', async () => {
      const res = await request(app)
        .post('/deva/designations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'audit specialist',
          order: 11,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('3. Should disable instead of deleting designation when assigned to active faculty', async () => {
      // Assign 'Audit Specialist' to active faculty
      await Faculty.updateOne({ empId: FAC_ACTIVE }, { $set: { designation: 'Audit Specialist' } });

      const delRes = await request(app)
        .delete(`/deva/designations/${testDesigId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.data.deactivated).toBe(true);

      const checkDesig = await Designation.findById(testDesigId);
      expect(checkDesig).not.toBeNull();
      expect(checkDesig.isEnabled).toBe(false);
    });

    it('4. Should permanently delete designation when not assigned to any faculty', async () => {
      // Revert faculty designation
      await Faculty.updateOne({ empId: FAC_ACTIVE }, { $set: { designation: 'Professor' } });

      const delRes = await request(app)
        .delete(`/deva/designations/${testDesigId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.data.deactivated).toBe(false);

      const checkDesig = await Designation.findById(testDesigId);
      expect(checkDesig).toBeNull();
    });
  });

  describe('Module: Workload Assignment Integrity & Relieved Faculty Rejection', () => {
    let testCourseDoc;

    beforeAll(async () => {
      testCourseDoc = await Course.findOne({ subjectCode: 'MA_CS101', academicYear: AY_ACTIVE });
    });

    it('1. Should reject assigning workload to relieved faculty member with 400', async () => {
      const res = await request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-academic-year', AY_ACTIVE)
        .set('x-semester', SEM)
        .send({
          empId: FAC_RELIEVED,
          courseId: testCourseDoc.courseId,
          year: 'III',
          section: '1',
          facultyRole: 'Main Faculty',
          academicYear: AY_ACTIVE,
          semester: SEM,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/relieved/i);
    });

    it('2. Should reject assigning workload to soft-deleted faculty member with 400', async () => {
      const res = await request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-academic-year', AY_ACTIVE)
        .set('x-semester', SEM)
        .send({
          empId: FAC_DELETED,
          courseId: testCourseDoc.courseId,
          year: 'III',
          section: '1',
          facultyRole: 'Main Faculty',
          academicYear: AY_ACTIVE,
          semester: SEM,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/deleted|deactivated/i);
    });

    it('3. Should strictly enforce manualL = 0 for Teaching Assistant assignments', async () => {
      const res = await request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-academic-year', AY_ACTIVE)
        .set('x-semester', SEM)
        .send({
          empId: TA_FAC,
          courseId: testCourseDoc.courseId,
          year: 'III',
          section: '1',
          facultyRole: 'TA',
          allocationRow: 1,
          manualL: 3, // Requesting lecture hours
          manualP: 2, // Practical hours
          academicYear: AY_ACTIVE,
          semester: SEM,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.manualL).toBe(0);
      expect(res.body.data.manualP).toBe(2);
      expect(res.body.data.facultyRole).toBe('TA');
    });
  });

  describe('Module: Stats & Dashboard Analytics Calculation', () => {
    it('1. Should accurately calculate aggregate workload hours with TA lecture hours = 0', async () => {
      const res = await request(app)
        .get('/deva/stats/dashboard-analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-academic-year', AY_ACTIVE)
        .set('x-semester', SEM);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      const allFaculty = [
        ...(res.body.data.overloaded || []),
        ...(res.body.data.pending || []),
        ...(res.body.data.perfect || []),
      ];

      const taStat = allFaculty.find(f => f.empId === TA_FAC);
      expect(taStat).toBeDefined();
      // TA had manualL requested as 3, but enforced to 0; manualP = 2 => assignedHours = 2
      expect(taStat.assignedHours).toBe(2);
    });
  });

  describe('Module: Workload Visibility Scoping (Hide All / Show All for Upcoming Academic Years & Semesters)', () => {
    beforeAll(async () => {
      await Workload.deleteMany({ empId: FAC_ACTIVE, subjectCode: { $in: ['MA_CS_VIS1', 'MA_CS_VIS2'] } });
      await Workload.create([
        {
          empId: FAC_ACTIVE,
          empName: 'Active Faculty Member',
          subjectCode: 'MA_CS_VIS1',
          subjectName: 'Test Active Subject',
          year: 'III',
          section: '1',
          fixedL: 3,
          manualL: 3,
          academicYear: AY_ACTIVE,
          semester: 'ODD',
          isVisible: true,
        },
        {
          empId: FAC_ACTIVE,
          empName: 'Active Faculty Member',
          subjectCode: 'MA_CS_VIS2',
          subjectName: 'Test Future Subject',
          year: 'IV',
          section: '2',
          fixedL: 3,
          manualL: 3,
          academicYear: AY_FUTURE,
          semester: 'EVEN',
          isVisible: true,
        },
      ]);
    });

    afterAll(async () => {
      await Workload.deleteMany({ empId: FAC_ACTIVE, subjectCode: { $in: ['MA_CS_VIS1', 'MA_CS_VIS2'] } });
    });

    it('1. Should hide all workloads specifically for upcoming academic year and EVEN semester without affecting active period', async () => {
      const res = await request(app)
        .patch('/deva/workloads/bulk-visibility')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          isVisible: false,
          academicYear: AY_FUTURE,
          semester: 'EVEN',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.academicYear).toBe(AY_FUTURE);
      expect(res.body.data.semester).toBe('EVEN');

      // Verify the future year workload is hidden
      const futureW = await Workload.findOne({ empId: FAC_ACTIVE, subjectCode: 'MA_CS_VIS2', academicYear: AY_FUTURE, semester: 'EVEN' });
      expect(futureW.isVisible).toBe(false);

      // Verify active year workload was NOT changed (remains true)
      const activeW = await Workload.findOne({ empId: FAC_ACTIVE, subjectCode: 'MA_CS_VIS1', academicYear: AY_ACTIVE, semester: 'ODD' });
      expect(activeW.isVisible).toBe(true);
    });

    it('2. Should show workloads for a specific faculty in upcoming academic year', async () => {
      const res = await request(app)
        .patch(`/deva/workloads/faculty-visibility/${FAC_ACTIVE}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          isVisible: true,
          academicYear: AY_FUTURE,
          semester: 'EVEN',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const futureW = await Workload.findOne({ empId: FAC_ACTIVE, subjectCode: 'MA_CS_VIS2', academicYear: AY_FUTURE, semester: 'EVEN' });
      expect(futureW.isVisible).toBe(true);
    });

    it('3. Should NOT revert isVisible to true when allocation reconciliation runs', async () => {
      const { syncAllocationDocToWorkload } = require('../../src/utils/allocationWorkloadSync');

      // First hide the workload
      await Workload.updateOne(
        { empId: FAC_ACTIVE, subjectCode: 'MA_CS_VIS2' },
        { $set: { isVisible: false } }
      );

      // Simulate an allocation sync for this existing workload
      const mockAlloc = {
        courseId: 9999,
        year: 'IV',
        section: '2',
        academicYear: AY_FUTURE,
        semester: 'EVEN',
        lectureSlots: [{ empId: FAC_ACTIVE, empName: 'Active Faculty Member', designation: 'Professor' }],
        tutorialSlots: [],
        practicalSlots: [],
      };

      await syncAllocationDocToWorkload(mockAlloc);

      // Verify isVisible remains false and was NOT reverted to true by reconciliation
      const checkW = await Workload.findOne({ empId: FAC_ACTIVE, subjectCode: 'MA_CS_VIS2', academicYear: AY_FUTURE, semester: 'EVEN' });
      expect(checkW).toBeDefined();
      expect(checkW.isVisible).toBe(false);
    });
  });
});
