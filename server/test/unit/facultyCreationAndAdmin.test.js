'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

const { signToken } = require('../../src/utils/jwt');
const facultyRouter = require('../../src/routes/faculty');
const workloadsRouter = require('../../src/routes/workloads');
const { requireAuth, requireAdmin } = require('../../src/middleware/auth');
const Faculty = require('../../src/models/Faculty');
const User = require('../../src/models/User');
const Designation = require('../../src/models/Designation');
const Workload = require('../../src/models/Workload');
const Course = require('../../src/models/Course');
const Setting = require('../../src/models/Setting');
const { TA_DESIGNATIONS, getDefaultCapacity, isTADesignation } = require('../../src/utils/designationUtils');
const { isBootstrapAdmin } = require('../../src/config/adminConfig');

const app = express();
app.use(express.json());

// Inject academic period context
app.use((req, res, next) => {
  req.academicPeriod = {
    academicYear: { name: '2025-2026' },
    academicYearSemester: { semesterType: 'ODD' },
    periodStart: new Date('2025-06-01'),
    periodEnd: new Date('2025-12-31')
  };
  req.getSemesterId = () => new mongoose.Types.ObjectId();
  req.getPeriodFilter = () => ({ academicYear: '2025-2026', semester: 'ODD' });
  next();
});

// Mount routes
app.use('/api/faculty', facultyRouter);
app.use('/deva/workloads', workloadsRouter);

// Test route to verify dynamic requireAdmin
app.get('/test-admin-gate', requireAuth, requireAdmin, (req, res) => {
  res.json({ success: true, user: req.user });
});

describe('Faculty Creation, 5 TA Designations, Dynamic Admin & Workload Restrictions', () => {
  jest.setTimeout(30000);
  const ADMIN_EMP_ID = 'TEST_ADMIN_AUTH_01';
  let adminToken;

  const testEmpIds = [
    'TEST_TA_ASSOC_01',
    'TEST_TA_MAIN_01',
    'TEST_TA_1_01',
    'TEST_TA_2_01',
    'TEST_TA_INST_01',
    'TEST_PROF_01',
    'TEST_BOOTSTRAP_01',
  ];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Setup Academic Year and Semester in DB
    const AcademicYear = require('../../src/models/AcademicYear');
    const AcademicYearSemester = require('../../src/models/AcademicYearSemester');
    const ay = await AcademicYear.findOneAndUpdate(
      { name: '2025-2026' },
      { name: '2025-2026', isCurrent: true, status: 'ACTIVE' },
      { upsert: true, new: true }
    );
    await AcademicYearSemester.findOneAndUpdate(
      { academicYearId: ay._id, semesterType: 'ODD' },
      { academicYearId: ay._id, semesterType: 'ODD', status: 'ACTIVE' },
      { upsert: true, new: true }
    );

    // Ensure default designations exist
    for (const desig of TA_DESIGNATIONS) {
      await Designation.findOneAndUpdate(
        { name: desig },
        { $setOnInsert: { name: desig, isEnabled: true, order: 10 } },
        { upsert: true }
      );
    }
    await Designation.findOneAndUpdate(
      { name: 'Assistant Professor' },
      { $setOnInsert: { name: 'Assistant Professor', isEnabled: true, order: 4 } },
      { upsert: true }
    );

    // Create Admin User
    await User.findOneAndUpdate(
      { empId: ADMIN_EMP_ID },
      {
        $set: {
          name: 'Test Administrator',
          role: 'admin',
          canAccessAdmin: true,
          email: 'admin.test@vignan.ac.in',
        },
      },
      { upsert: true }
    );

    adminToken = signToken({
      id: ADMIN_EMP_ID,
      empId: ADMIN_EMP_ID,
      role: 'admin',
      name: 'Test Administrator',
      canAccessAdmin: true,
    });
  }, 30000);

  afterAll(async () => {
    await Faculty.deleteMany({ empId: { $in: [...testEmpIds, ADMIN_EMP_ID] } });
    await User.deleteMany({ empId: { $in: [...testEmpIds, ADMIN_EMP_ID] } });
    await Workload.deleteMany({ empId: { $in: testEmpIds } });
    await Course.deleteMany({ courseId: 98765 });
    await mongoose.disconnect();
  }, 30000);

  test('TA_DESIGNATIONS includes all 5 required designations', () => {
    expect(TA_DESIGNATIONS).toContain('Teaching Associate');
    expect(TA_DESIGNATIONS).toContain('Teaching Assistant');
    expect(TA_DESIGNATIONS).toContain('Teaching Assistant-I');
    expect(TA_DESIGNATIONS).toContain('Teaching Assistant-II');
    expect(TA_DESIGNATIONS).toContain('Teaching Instructor');
    expect(TA_DESIGNATIONS).toHaveLength(5);
  });

  test('getDefaultCapacity returns 12 for all 5 TA designations and 18 for non-TA', () => {
    for (const d of TA_DESIGNATIONS) {
      expect(isTADesignation(d)).toBe(true);
      expect(getDefaultCapacity(d)).toBe(12);
    }
    expect(isTADesignation('Assistant Professor')).toBe(false);
    expect(getDefaultCapacity('Assistant Professor')).toBe(18);
  });

  test('POST /api/faculty creates faculty with Teaching Associate (no isAdminEmployeeId error, capacity 12)', async () => {
    const res = await request(app)
      .post('/api/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        empId: 'TEST_TA_ASSOC_01',
        name: 'Dr. Associate TA',
        designation: 'Teaching Associate',
        mobile: '9876543210',
        email: 'ta_assoc@vignan.ac.in',
        department: 'CSE',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.empId).toBe('TEST_TA_ASSOC_01');
    expect(res.body.data.capacity).toBe(12);

    // Verify User account
    const user = await User.findOne({ empId: 'TEST_TA_ASSOC_01' });
    expect(user).toBeTruthy();
    expect(user.role).toBe('faculty');
    expect(user.canAccessAdmin).toBe(false);
  });

  test('POST /api/faculty creates faculty with Teaching Assistant-I (capacity 12)', async () => {
    const res = await request(app)
      .post('/api/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        empId: 'TEST_TA_1_01',
        name: 'Assistant One',
        designation: 'Teaching Assistant-I',
        mobile: '9876543211',
        email: 'ta_1@vignan.ac.in',
        department: 'CSE',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.capacity).toBe(12);

    const user = await User.findOne({ empId: 'TEST_TA_1_01' });
    expect(user).toBeTruthy();
    expect(user.role).toBe('faculty');
    expect(user.canAccessAdmin).toBe(false);
  });

  test('POST /api/faculty creates faculty with Teaching Assistant-II (capacity 12)', async () => {
    const res = await request(app)
      .post('/api/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        empId: 'TEST_TA_2_01',
        name: 'Assistant Two',
        designation: 'Teaching Assistant-II',
        mobile: '9876543212',
        email: 'ta_2@vignan.ac.in',
        department: 'CSE',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.capacity).toBe(12);

    const user = await User.findOne({ empId: 'TEST_TA_2_01' });
    expect(user).toBeTruthy();
    expect(user.role).toBe('faculty');
    expect(user.canAccessAdmin).toBe(false);
  });

  test('POST /api/faculty creates faculty with Teaching Instructor (capacity 12)', async () => {
    const res = await request(app)
      .post('/api/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        empId: 'TEST_TA_INST_01',
        name: 'Instructor TA',
        designation: 'Teaching Instructor',
        mobile: '9876543213',
        email: 'ta_inst@vignan.ac.in',
        department: 'CSE',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.capacity).toBe(12);

    const user = await User.findOne({ empId: 'TEST_TA_INST_01' });
    expect(user).toBeTruthy();
    expect(user.role).toBe('faculty');
    expect(user.canAccessAdmin).toBe(false);
  });

  test('POST /api/faculty creates non-TA faculty with Assistant Professor (capacity 18)', async () => {
    const res = await request(app)
      .post('/api/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        empId: 'TEST_PROF_01',
        name: 'Prof Non TA',
        designation: 'Assistant Professor',
        mobile: '9876543214',
        email: 'prof@vignan.ac.in',
        department: 'CSE',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.capacity).toBe(18);

    const user = await User.findOne({ empId: 'TEST_PROF_01' });
    expect(user).toBeTruthy();
    expect(user.role).toBe('faculty');
    expect(user.canAccessAdmin).toBe(false);
  });

  test('Dynamic Admin Management: DB canAccessAdmin grants admin access dynamically in requireAuth', async () => {
    // Generate token for TEST_PROF_01 with initial role 'faculty'
    const profToken = signToken({
      id: 'TEST_PROF_01',
      empId: 'TEST_PROF_01',
      role: 'faculty',
      name: 'Prof Non TA',
      canAccessAdmin: false,
    });

    // Initial check: should be forbidden
    const resForbidden = await request(app)
      .get('/test-admin-gate')
      .set('Authorization', `Bearer ${profToken}`);

    expect(resForbidden.status).toBe(403);

    // Promote user in DB (simulating Admin Management toggle)
    await User.updateOne(
      { empId: 'TEST_PROF_01' },
      { $set: { canAccessAdmin: true, role: 'admin' } }
    );

    // Next request with same token: dynamic sync should now allow admin access!
    const resAllowed = await request(app)
      .get('/test-admin-gate')
      .set('Authorization', `Bearer ${profToken}`);

    expect(resAllowed.status).toBe(200);
    expect(resAllowed.body.success).toBe(true);
    expect(resAllowed.body.user.canAccessAdmin).toBe(true);
    expect(resAllowed.body.user.role).toBe('admin');

    // Demote user in DB
    await User.updateOne(
      { empId: 'TEST_PROF_01' },
      { $set: { canAccessAdmin: false, role: 'faculty' } }
    );

    // Request after demotion: immediately forbidden again!
    const resRevoked = await request(app)
      .get('/test-admin-gate')
      .set('Authorization', `Bearer ${profToken}`);

    expect(resRevoked.status).toBe(403);
  });

  test('Workload restriction: TA designation prohibited from Main Faculty and Supporting Faculty', async () => {
    // Setup a dummy course
    await Course.findOneAndUpdate(
      { courseId: 98765 },
      {
        $set: {
          courseId: 98765,
          subjectCode: 'CS9876',
          subjectName: 'Test Systems',
          shortName: 'TS',
          year: 'III',
          program: 'B.Tech',
          semester: 'ODD',
          academicYear: '2025-2026',
          courseType: 'Mandatory',
          L: 3, T: 1, P: 2, C: 5,
        },
      },
      { upsert: true }
    );

    // Try assigning Teaching Associate as Main Faculty
    const resMain = await request(app)
      .post('/deva/workloads')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-academic-year', '2025-2026')
      .set('x-semester', 'ODD')
      .send({
        empId: 'TEST_TA_ASSOC_01',
        courseId: 98765,
        facultyRole: 'Main Faculty',
        year: '3',
        section: '1',
      });

    expect(resMain.status).toBe(400);
    expect(resMain.body.success).toBe(false);
    expect(resMain.body.message).toMatch(/can only be allocated as TA/i);

    // Try assigning Teaching Assistant-I as Supporting Faculty
    const resSupporting = await request(app)
      .post('/deva/workloads')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-academic-year', '2025-2026')
      .set('x-semester', 'ODD')
      .send({
        empId: 'TEST_TA_1_01',
        courseId: 98765,
        facultyRole: 'Supporting Faculty',
        year: '3',
        section: '1',
      });

    expect(resSupporting.status).toBe(400);
    expect(resSupporting.body.success).toBe(false);
    expect(resSupporting.body.message).toMatch(/can only be allocated as TA/i);

    // Assigning as TA role succeeds
    const resTa = await request(app)
      .post('/deva/workloads')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-academic-year', '2025-2026')
      .set('x-semester', 'ODD')
      .send({
        empId: 'TEST_TA_ASSOC_01',
        courseId: 98765,
        facultyRole: 'TA',
        year: '3',
        section: '1',
        allocationRow: 1,
        manualP: 2,
      });

    expect([200, 201]).toContain(resTa.status);
    expect(resTa.body.success).toBe(true);
  });
});
