'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../src/index');
const Workload = require('../../src/models/Workload');
const CourseAllocation = require('../../src/models/CourseAllocation');
const Course = require('../../src/models/Course');
const Section = require('../../src/models/Section');
const Faculty = require('../../src/models/Faculty');
const User = require('../../src/models/User');
const AcademicYear = require('../../src/models/AcademicYear');
const AcademicYearSemester = require('../../src/models/AcademicYearSemester');
const { signToken } = require('../../src/utils/jwt');
const { reconcileAllAllocationsToWorkload } = require('../../src/utils/allocationWorkloadSync');

jest.setTimeout(35000);

describe('Database Integrity, Permanent Deletion & Duplicate Prevention Suite', () => {
  let adminToken;
  let testAy;
  let testSem;
  let testFaculty;
  let testCourse;
  let testSection;
  const testEmpId = 'TEST_DEL_FAC_001';
  const testCourseId = 999991;
  const testSectionName = '1';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/faculty_workload');
    }

    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      adminUser = await User.create({
        empId: 'TEST_ADMIN_DEL_01',
        name: 'Test Admin Del',
        role: 'admin',
        tokenVersion: 1,
      });
    }

    adminToken = signToken({
      id: adminUser.empId,
      empId: adminUser.empId,
      role: 'admin',
      tokenVersion: adminUser.tokenVersion || 0,
    });

    testAy = await AcademicYear.findOne({ isCurrent: true }) || await AcademicYear.findOne({});
    if (!testAy) {
      testAy = await AcademicYear.create({
        name: '2026-2027',
        isCurrent: true,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-05-31'),
      });
    }

    testSem = await AcademicYearSemester.findOne({ academicYearId: testAy._id }) || await AcademicYearSemester.findOne({});

    // Clean up prior test artifacts
    await Faculty.deleteMany({ empId: { $in: [testEmpId, 'TEST_DEL_FAC_002'] } });
    await Course.deleteMany({ courseId: testCourseId });
    await Workload.deleteMany({ empId: { $in: [testEmpId, 'TEST_DEL_FAC_002'] } });
    await CourseAllocation.deleteMany({ courseId: testCourseId });

    testFaculty = await Faculty.create({
      empId: testEmpId,
      name: 'Dr. Test Integrity',
      email: 'test_integrity@example.com',
      designation: 'Professor',
      department: 'CSE',
      category: 'Faculty',
      joiningDate: new Date('2020-01-01'),
      isDeleted: false,
    });

    testCourse = await Course.create({
      courseId: testCourseId,
      subjectCode: 'CS9999',
      subjectName: 'Test Integrity Architecture',
      shortName: 'TIA',
      academicYear: testAy.name,
      courseType: 'Mandatory',
      program: 'B.Tech',
      year: 'II',
      semester: 'ODD',
      L: 3,
      T: 1,
      P: 0,
      C: 4,
      isDeleted: false,
    });

    testSection = await Section.findOne({ name: 'TEST_SEC_DEL_X' });
    if (!testSection) {
      testSection = await Section.create({
        name: 'TEST_SEC_DEL_X',
        year: 'II',
        department: 'CSE',
        status: 'Active',
        isDeleted: false,
      });
    }
  });

  afterAll(async () => {
    await Workload.deleteMany({ empId: { $in: [testEmpId, 'TEST_DEL_FAC_002'] } });
    await CourseAllocation.deleteMany({ courseId: testCourseId });
    await Faculty.deleteMany({ empId: { $in: [testEmpId, 'TEST_DEL_FAC_002'] } });
    await Course.deleteMany({ courseId: testCourseId });
    await Section.deleteMany({ name: 'TEST_SEC_DEL_X' });
  });

  describe('1. Workload Permanent Soft-Deletion & Anti-Resurrection', () => {
    let createdWorkload;
    let allocationDoc;

    it('should create a workload and corresponding CourseAllocation slot', async () => {
      // Create CourseAllocation
      allocationDoc = await CourseAllocation.create({
        academicYear: testAy.name,
        semester: 'ODD',
        year: 'II',
        section: testSectionName,
        courseId: testCourseId,
        subjectCode: testCourse.subjectCode,
        subjectName: testCourse.subjectName,
        lectureSlot: {
          empId: testEmpId,
          empName: testFaculty.name,
          designation: testFaculty.designation,
          hours: 3,
        },
        isDeleted: false,
      });

      // Create Workload
      createdWorkload = await Workload.create({
        empId: testEmpId,
        empName: testFaculty.name,
        designation: testFaculty.designation,
        courseId: testCourseId,
        subjectCode: testCourse.subjectCode,
        subjectName: testCourse.subjectName,
        year: '2', // Test digit canonicalization to Roman II
        section: testSectionName,
        academicYear: testAy.name,
        semester: 'ODD',
        facultyRole: 'Main Faculty',
        allocationStatus: 'ALLOCATED',
        isDeleted: false,
      });

      expect(createdWorkload.year).toBe('II');
      expect(createdWorkload.isDeleted).toBe(false);
    });

    it('should delete the workload via DELETE /deva/workloads/:id and purge allocation slots', async () => {
      const res = await request(app)
        .delete(`/deva/workloads/${createdWorkload._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Verify Workload is soft deleted with CANCELLED status
      const updatedWl = await Workload.findById(createdWorkload._id);
      expect(updatedWl.isDeleted).toBe(true);
      expect(updatedWl.allocationStatus).toBe('CANCELLED');

      // Verify CourseAllocation slot was cleared
      const updatedAlloc = await CourseAllocation.findById(allocationDoc._id);
      expect(updatedAlloc.lectureSlot.empId).toBe('');
      expect(updatedAlloc.lectureSlot.hours).toBe(0);
    });

    it('should NOT resurrect the deleted workload during reconcileAllAllocationsToWorkload', async () => {
      // Run reconciliation that previously resurrected deleted records
      await reconcileAllAllocationsToWorkload(testAy.name, 'ODD');

      // Verify the workload remains deleted
      const checkWl = await Workload.findById(createdWorkload._id);
      expect(checkWl.isDeleted).toBe(true);
      expect(checkWl.allocationStatus).toBe('CANCELLED');
    });

    it('should NOT return the deleted workload in GET /deva/workloads', async () => {
      const res = await request(app)
        .get(`/deva/workloads?academicYear=${encodeURIComponent(testAy.name)}&semester=ODD`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const workloads = res.body.data || res.body;
      const found = workloads.find(w => String(w._id || w.id) === String(createdWorkload._id));
      expect(found).toBeUndefined();
    });
  });

  describe('2. Duplicate Prevention Across All Roles and Endpoints', () => {
    let activeWl;

    beforeEach(async () => {
      await Workload.deleteMany({ courseId: testCourseId, section: testSectionName });
      activeWl = await Workload.create({
        empId: testEmpId,
        empName: testFaculty.name,
        designation: testFaculty.designation,
        courseId: testCourseId,
        subjectCode: testCourse.subjectCode,
        subjectName: testCourse.subjectName,
        year: 'II',
        section: testSectionName,
        academicYear: testAy.name,
        semester: 'ODD',
        facultyRole: 'Main Faculty',
        allocationStatus: 'ALLOCATED',
        isDeleted: false,
      });
    });

    it('should reject a duplicate Main Faculty assignment when another faculty is assigned', async () => {
      const secondFaculty = await Faculty.create({
        empId: 'TEST_DEL_FAC_002',
        name: 'Dr. Second Faculty',
        email: 'test_sec_fac@example.com',
        designation: 'Associate Professor',
        department: 'CSE',
        category: 'Faculty',
        joiningDate: new Date('2020-01-01'),
        isDeleted: false,
      });

      const res = await request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          empId: secondFaculty.empId,
          courseId: testCourseId,
          year: 'II',
          section: testSectionName,
          academicYear: testAy.name,
          semester: 'ODD',
          facultyRole: 'Main Faculty',
        });

      await Faculty.deleteOne({ empId: secondFaculty.empId });
      expect([400, 409]).toContain(res.status);
    });

    it('should allow assignment after the existing workload is deleted', async () => {
      // Soft-delete existing workload
      const delRes = await request(app)
        .delete(`/deva/workloads/${activeWl._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delRes.status).toBe(200);

      // Now create new assignment
      const res = await request(app)
        .post('/deva/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          empId: testEmpId,
          courseId: testCourseId,
          year: 'II',
          section: testSectionName,
          academicYear: testAy.name,
          semester: 'ODD',
          facultyRole: 'Main Faculty',
        });

      expect([200, 201]).toContain(res.status);
    });
  });

  describe('3. Clean Cascade on Section Deletion', () => {
    it('should soft-delete associated workloads and allocations when Section is deleted', async () => {
      // Create workload and allocation for the section
      const secWl = await Workload.create({
        empId: testEmpId,
        empName: testFaculty.name,
        designation: testFaculty.designation,
        courseId: testCourseId,
        subjectCode: testCourse.subjectCode,
        subjectName: testCourse.subjectName,
        year: 'II',
        section: testSection.name,
        academicYear: testAy.name,
        semester: 'ODD',
        facultyRole: 'Main Faculty',
        allocationStatus: 'ALLOCATED',
        isDeleted: false,
      });

      // Delete the section via API
      const res = await request(app)
        .delete(`/deva/sections/${testSection._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Verify workload is cascade marked CANCELLED and deleted
      const updatedWl = await Workload.findById(secWl._id);
      expect(updatedWl.isDeleted).toBe(true);
      expect(updatedWl.allocationStatus).toBe('CANCELLED');
    });
  });
});
