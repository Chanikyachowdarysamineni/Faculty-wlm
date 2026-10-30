'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../src/index');
const Designation = require('../../src/models/Designation');
const Faculty = require('../../src/models/Faculty');
const Workload = require('../../src/models/Workload');
const User = require('../../src/models/User');
const AcademicYear = require('../../src/models/AcademicYear');
const AcademicYearSemester = require('../../src/models/AcademicYearSemester');
const { signToken } = require('../../src/utils/jwt');

describe('Dynamic Designation Dashboard & Details Suite', () => {
  let adminToken;
  let testAyId;
  let testSemId;
  let createdDesignationIds = [];
  let createdFacultyEmpIds = [];
  let createdWorkloadIds = [];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/faculty_workload');
    }

    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      adminUser = await User.create({
        empId: 'TEST_ADMIN_DESIG_01',
        name: 'Test Admin',
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
        status: 'ACTIVE'
      });
    }
    testSemId = sem._id;
  }, 30000);

  afterAll(async () => {
    if (createdDesignationIds.length > 0) {
      await Designation.deleteMany({ _id: { $in: createdDesignationIds } });
    }
    if (createdFacultyEmpIds.length > 0) {
      await Faculty.deleteMany({ empId: { $in: createdFacultyEmpIds } });
    }
    if (createdWorkloadIds.length > 0) {
      await Workload.deleteMany({ _id: { $in: createdWorkloadIds } });
    }
    await mongoose.disconnect();
  }, 30000);

  test('1. GET /api/stats/dashboard-analytics returns dynamic designationStats for all active designations', async () => {
    const res = await request(app)
      .get('/api/stats/dashboard-analytics?academicYear=2026-2027&semester=ODD')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-academic-year-id', String(testAyId))
      .set('x-semester-id', String(testSemId));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.designationStats)).toBe(true);
    expect(res.body.data.designationStats.length).toBeGreaterThan(0);

    const firstCard = res.body.data.designationStats[0];
    expect(firstCard).toHaveProperty('id');
    expect(firstCard).toHaveProperty('designation');
    expect(firstCard).toHaveProperty('count');
    expect(firstCard).toHaveProperty('totalCapacity');
    expect(firstCard).toHaveProperty('totalAllocated');
    expect(firstCard).toHaveProperty('remainingCapacity');
    expect(firstCard.remainingCapacity).toBe(firstCard.totalCapacity - firstCard.totalAllocated);
  }, 15000);

  test('2. Dynamically created designation in Designation Management automatically reflects in analytics without code change', async () => {
    const uniqueName = `Senior Research TA ${Date.now()}`;
    const newDesig = await Designation.create({
      name: uniqueName,
      code: `SR_TA_${Date.now()}`.slice(0, 15),
      isEnabled: true,
      order: 99
    });
    createdDesignationIds.push(newDesig._id);

    const res = await request(app)
      .get('/api/stats/dashboard-analytics?academicYear=2026-2027&semester=ODD')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-academic-year-id', String(testAyId))
      .set('x-semester-id', String(testSemId));

    expect(res.status).toBe(200);
    const card = res.body.data.designationStats.find(d => String(d.id) === String(newDesig._id));
    expect(card).toBeDefined();
    expect(card.designation).toBe(uniqueName);
    expect(card.count).toBe(0);
    expect(card.totalCapacity).toBe(0);
    expect(card.totalAllocated).toBe(0);
    expect(card.remainingCapacity).toBe(0);
  }, 15000);

  test('3. Associating faculty to new designation immediately updates count and capacity', async () => {
    const desigId = createdDesignationIds[0];
    const desig = await Designation.findById(desigId);

    const testEmpId = `DYN_FAC_${Date.now()}`.slice(0, 15);
    await Faculty.create({
      empId: testEmpId,
      name: 'Dr. Dynamic Test Faculty',
      designation: desig.name,
      designationId: desig._id,
      capacity: 12,
      department: 'CSE',
      mobile: '9876543210',
      email: `${testEmpId.toLowerCase()}@vignan.ac.in`,
      joiningDate: new Date('2024-01-01'),
      status: 'active'
    });
    createdFacultyEmpIds.push(testEmpId);

    const res = await request(app)
      .get('/api/stats/dashboard-analytics?academicYear=2026-2027&semester=ODD')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-academic-year-id', String(testAyId))
      .set('x-semester-id', String(testSemId));

    expect(res.status).toBe(200);
    const card = res.body.data.designationStats.find(d => String(d.id) === String(desig._id));
    expect(card).toBeDefined();
    expect(card.count).toBe(1);
    expect(card.totalCapacity).toBe(12);
    expect(card.totalAllocated).toBe(0);
    expect(card.remainingCapacity).toBe(12);
  }, 15000);

  test('4. Assigning workload dynamically updates assigned hours, remaining capacity, and overload status', async () => {
    const desigId = createdDesignationIds[0];
    const testEmpId = createdFacultyEmpIds[0];

    const wl = await Workload.create({
      empId: testEmpId,
      empName: 'Dr. Dynamic Test Faculty',
      facultyRole: 'Main Faculty',
      designation: 'Senior Research TA',
      courseId: 99999,
      subjectCode: 'DYN101',
      subjectName: 'Dynamic Testing Course',
      year: 'III',
      section: '1',
      fixedL: 2,
      fixedT: 0,
      fixedP: 2,
      C: 3,
      manualL: 6,
      manualT: 4,
      manualP: 4,
      capacityHours: 12,
      academicYear: '2026-2027',
      semester: 'ODD',
      allocationStatus: 'ALLOCATED',
      isDeleted: false
    });
    createdWorkloadIds.push(wl._id);

    const res = await request(app)
      .get('/api/stats/dashboard-analytics?academicYear=2026-2027&semester=ODD')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-academic-year-id', String(testAyId))
      .set('x-semester-id', String(testSemId));

    expect(res.status).toBe(200);
    const card = res.body.data.designationStats.find(d => String(d.id) === String(desigId));
    expect(card).toBeDefined();
    expect(card.count).toBe(1);
    expect(card.totalCapacity).toBe(12);
    expect(card.totalAllocated).toBe(14);
    expect(card.remainingCapacity).toBe(-2);
    expect(card.isOverloaded).toBe(true);
  }, 15000);

  test('5. Dedicated details endpoint GET /api/designations/:id/workload-details returns all 12 faculty fields', async () => {
    const desigId = createdDesignationIds[0];

    const res = await request(app)
      .get(`/api/designations/${desigId}/workload-details?academicYear=2026-2027&semester=ODD`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-academic-year-id', String(testAyId))
      .set('x-semester-id', String(testSemId));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('designation');
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data).toHaveProperty('faculty');

    expect(res.body.data.summary.totalFaculty).toBe(1);
    expect(res.body.data.summary.totalAssignedHours).toBe(14);
    expect(res.body.data.summary.totalCapacity).toBe(12);
    expect(res.body.data.summary.remainingCapacity).toBe(-2);
    expect(res.body.data.summary.isOverloaded).toBe(true);

    const facultyList = res.body.data.faculty;
    expect(facultyList.length).toBe(1);
    const f = facultyList[0];

    expect(f).toHaveProperty('sNo', 1);
    expect(f).toHaveProperty('empId', createdFacultyEmpIds[0]);
    expect(f).toHaveProperty('name', 'Dr. Dynamic Test Faculty');
    expect(f).toHaveProperty('designation');
    expect(f).toHaveProperty('mobile', '9876543210');
    expect(f).toHaveProperty('email');
    expect(f).toHaveProperty('joiningDate');
    expect(f).toHaveProperty('relievingDate');
    expect(f).toHaveProperty('assignedHours', 14);
    expect(f).toHaveProperty('capacity', 12);
    expect(f).toHaveProperty('remainingCapacity', -2);
    expect(f).toHaveProperty('status', 'Overload');
  }, 15000);

  test('6. Dedicated details endpoint rejects unauthorized non-admin access', async () => {
    const desigId = createdDesignationIds[0];

    // No token -> 401
    const resNoToken = await request(app)
      .get(`/api/designations/${desigId}/workload-details?academicYear=2026-2027&semester=ODD`);
    expect(resNoToken.status).toBe(401);

    // Create a real faculty user in DB
    const facultyUser = await User.create({
      empId: 'TEST_FAC_NON_ADMIN',
      name: 'Non Admin Faculty',
      role: 'faculty',
      passwordHash: 'dummy_hash_for_test',
      tokenVersion: 1
    });

    const facultyToken = signToken({
      id: facultyUser.empId,
      empId: facultyUser.empId,
      role: 'faculty',
      tokenVersion: facultyUser.tokenVersion || 0
    });

    const resForbidden = await request(app)
      .get(`/api/designations/${desigId}/workload-details?academicYear=2026-2027&semester=ODD`)
      .set('Authorization', `Bearer ${facultyToken}`);
    expect([401, 403]).toContain(resForbidden.status);

    await User.deleteOne({ _id: facultyUser._id });
  }, 15000);
});
