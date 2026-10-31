'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../src/index');
const Designation = require('../../src/models/Designation');
const Faculty = require('../../src/models/Faculty');
const Workload = require('../../src/models/Workload');
const Course = require('../../src/models/Course');
const User = require('../../src/models/User');
const AcademicYear = require('../../src/models/AcademicYear');
const AcademicYearSemester = require('../../src/models/AcademicYearSemester');
const { signToken } = require('../../src/utils/jwt');
const { isTaDesignationAsync, getDesignationCategory } = require('../../src/utils/designationUtils');

describe('Designation Workload Search & Eligibility Suite', () => {
  let adminToken;
  let testAyId;
  let testSemId;
  let regularFaculty;
  let taFaculty;
  let customTaFaculty;
  let testCourse;
  let createdDesignations = [];
  let createdWorkloads = [];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/faculty_workload');
    }

    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      adminUser = await User.create({
        empId: 'TEST_ADMIN_DW_01',
        name: 'Test Admin DW',
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

    let sem = await AcademicYearSemester.findOne({ academicYearId: ay._id, semesterType: 'ODD' });
    if (!sem) {
      sem = await AcademicYearSemester.create({
        academicYearId: ay._id,
        semesterType: 'ODD',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-11-30'),
        status: 'active'
      });
    }
    testSemId = sem._id;

    // Create course
    testCourse = await Course.findOne({ courseId: 987654 });
    if (!testCourse) {
      testCourse = await Course.create({
        courseId: 987654,
        subjectCode: 'CS999',
        subjectName: 'Advanced Eligibility Testing',
        shortName: 'AET',
        program: 'B.Tech',
        year: 'III',
        semester: 'ODD',
        academicYear: '2026-2027',
        courseType: 'Core',
        courseTypeKey: 'CORE',
        L: 3,
        T: 1,
        P: 2,
        C: 4
      });
    }

    // 1. Regular Faculty
    regularFaculty = await Faculty.findOne({ empId: 'TEST_DW_FAC_01' });
    if (!regularFaculty) {
      regularFaculty = await Faculty.create({
        empId: 'TEST_DW_FAC_01',
        name: 'Dr. Sarah Connor',
        designation: 'Associate Professor',
        category: 'FACULTY',
        department: 'CSE',
        capacity: 18
      });
    }

    // 2. Standard TA Faculty
    taFaculty = await Faculty.findOne({ empId: 'TEST_DW_TA_01' });
    if (!taFaculty) {
      taFaculty = await Faculty.create({
        empId: 'TEST_DW_TA_01',
        name: 'John Connor',
        designation: 'Teaching Associate',
        category: 'TA_INSTRUCTOR',
        department: 'CSE',
        capacity: 12
      });
    }

    // 3. Custom Dynamic TA Designation created via Designation Management
    const customDesig = await Designation.findOneAndUpdate(
      { name: 'Adjunct Lab Instructor' },
      { $set: { name: 'Adjunct Lab Instructor', category: 'TA_INSTRUCTOR', order: 99, isEnabled: true } },
      { upsert: true, new: true }
    );
    createdDesignations.push(customDesig._id);

    customTaFaculty = await Faculty.findOne({ empId: 'TEST_DW_CUSTOM_TA_01' });
    if (!customTaFaculty) {
      customTaFaculty = await Faculty.create({
        empId: 'TEST_DW_CUSTOM_TA_01',
        name: 'Kyle Reese',
        designation: 'Adjunct Lab Instructor',
        designationId: customDesig._id,
        category: 'TA_INSTRUCTOR',
        department: 'CSE',
        capacity: 12
      });
    }
  });

  afterAll(async () => {
    try {
      await Faculty.deleteMany({ empId: { $in: ['TEST_DW_FAC_01', 'TEST_DW_TA_01', 'TEST_DW_CUSTOM_TA_01'] } });
      await Designation.deleteMany({ _id: { $in: createdDesignations } });
      await Course.deleteOne({ courseId: 987654 });
      if (createdWorkloads.length) {
        await Workload.deleteMany({ _id: { $in: createdWorkloads } });
      }
    } catch (e) {
      // ignore teardown error
    }
  });

  describe('Designation Category & Utils Check', () => {
    it('correctly classifies standard and custom designations', async () => {
      const regularCat = await getDesignationCategory('Associate Professor');
      expect(regularCat).toBe('FACULTY');
      const isRegularTa = await isTaDesignationAsync('Associate Professor');
      expect(isRegularTa).toBe(false);

      const taCat = await getDesignationCategory('Teaching Associate');
      expect(taCat).toBe('TA_INSTRUCTOR');
      const isTa = await isTaDesignationAsync('Teaching Associate');
      expect(isTa).toBe(true);

      const customCat = await getDesignationCategory('Adjunct Lab Instructor');
      expect(customCat).toBe('TA_INSTRUCTOR');
      const isCustomTa = await isTaDesignationAsync('Adjunct Lab Instructor');
      expect(isCustomTa).toBe(true);
    });
  });

  describe('GET /api/workloads/eligible-faculty', () => {
    it('returns eligible faculty for Main Faculty role (excludes TA designations)', async () => {
      const res = await request(app)
        .get('/api/workloads/eligible-faculty')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          facultyRole: 'Main Faculty',
          academicYear: '2026-2027',
          semester: 'ODD',
          search: 'Connor'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const drSarah = res.body.data.find(f => f.empId === 'TEST_DW_FAC_01');
      expect(drSarah).toBeDefined();
      expect(drSarah.isEligible).toBe(true);
      expect(drSarah.category).toBe('FACULTY');

      const johnTa = res.body.data.find(f => f.empId === 'TEST_DW_TA_01');
      expect(johnTa).toBeDefined();
      expect(johnTa.isEligible).toBe(false);
      expect(johnTa.category).toBe('TA_INSTRUCTOR');
      expect(johnTa.ineligibleReason).toMatch(/can only be allocated as TA/i);
    });

    it('returns eligible faculty with onlyEligible=true query filter', async () => {
      const res = await request(app)
        .get('/api/workloads/eligible-faculty')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          facultyRole: 'Main Faculty',
          academicYear: '2026-2027',
          semester: 'ODD',
          search: 'Connor',
          onlyEligible: 'true'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const items = res.body.data;
      expect(items.every(f => f.isEligible)).toBe(true);
      expect(items.some(f => f.empId === 'TEST_DW_FAC_01')).toBe(true);
      expect(items.some(f => f.empId === 'TEST_DW_TA_01')).toBe(false);
    });

    it('returns both Regular Faculty and TAs as eligible when facultyRole=TA', async () => {
      const res = await request(app)
        .get('/api/workloads/eligible-faculty')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          facultyRole: 'TA',
          allocationSlot: 'R2',
          academicYear: '2026-2027',
          semester: 'ODD',
          search: 'Connor'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const drSarah = res.body.data.find(f => f.empId === 'TEST_DW_FAC_01');
      expect(drSarah).toBeDefined();
      expect(drSarah.isEligible).toBe(true);

      const johnTa = res.body.data.find(f => f.empId === 'TEST_DW_TA_01');
      expect(johnTa).toBeDefined();
      expect(johnTa.isEligible).toBe(true);
    });

    it('supports partial case-insensitive search by empId or name', async () => {
      const res = await request(app)
        .get('/api/workloads/eligible-faculty')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          academicYear: '2026-2027',
          semester: 'ODD',
          search: 'test_dw_custom'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].empId).toBe('TEST_DW_CUSTOM_TA_01');
      expect(res.body.data[0].name).toBe('Kyle Reese');
      expect(res.body.data[0].category).toBe('TA_INSTRUCTOR');
    });
  });

  describe('POST /api/workloads Backend Validation', () => {
    it('blocks assigning a TA designation as Main Faculty with a 400 response', async () => {
      const res = await request(app)
        .post('/api/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          empId: 'TEST_DW_TA_01',
          facultyRole: 'Main Faculty',
          courseId: 987654,
          year: 'III',
          section: '1',
          academicYear: '2026-2027',
          semester: 'ODD'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/can only be allocated as TA/i);
    });

    it('blocks assigning a custom TA designation as Supporting Faculty with a 400 response', async () => {
      const res = await request(app)
        .post('/api/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          empId: 'TEST_DW_CUSTOM_TA_01',
          facultyRole: 'Supporting Faculty',
          courseId: 987654,
          year: 'III',
          section: '1',
          academicYear: '2026-2027',
          semester: 'ODD'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/can only be allocated as TA/i);
    });

    it('allows assigning a TA designation as TA role (R2) successfully', async () => {
      const res = await request(app)
        .post('/api/workloads')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          empId: 'TEST_DW_TA_01',
          facultyRole: 'TA',
          allocationRow: 1, // R2
          courseId: 987654,
          year: 'III',
          section: '1',
          academicYear: '2026-2027',
          semester: 'ODD',
          manualL: 0,
          manualT: 1,
          manualP: 2
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      if (res.body.data?._id) {
        createdWorkloads.push(res.body.data._id);
      }
    });
  });
});
