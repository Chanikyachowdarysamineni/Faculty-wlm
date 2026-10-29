'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const adminManagementRouter = require('../../src/routes/adminManagement');
const User = require('../../src/models/User');
const Faculty = require('../../src/models/Faculty');

const { signToken } = require('../../src/utils/jwt');

const app = express();
app.use(express.json());
app.use('/api/admin-management', adminManagementRouter);

describe('Admin Management: Matching FacultyPage list', () => {
  let adminToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    adminToken = signToken({ id: '231fa04860', empId: '231fa04860', role: 'admin', name: 'Admin User' });
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
  }, 30000);

  test('GET /api/admin-management/users returns active faculty list matching FacultyPage', async () => {
    const res = await request(app)
      .get('/api/admin-management/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const facultyList = res.body.data;
    expect(facultyList.length).toBeGreaterThan(0);

    // Verify fields
    const first = facultyList[0];
    expect(first).toHaveProperty('empId');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('designation');
    expect(first).toHaveProperty('department');
    expect(first).toHaveProperty('slNo');
    expect(first).toHaveProperty('isEffectiveAdmin');

    // Verify deleted faculty are NOT included
    const deletedEmpIds = ['03500', '3314', '2493', 'TEST999', 'admin'];
    const foundDeleted = facultyList.filter(f => deletedEmpIds.includes(f.empId));
    expect(foundDeleted).toHaveLength(0);
  });

  test('POST /api/admin-management/toggle-admin toggles admin status on active faculty member', async () => {
    // Pick the first faculty member in the list
    const getRes = await request(app)
      .get('/api/admin-management/users')
      .set('Authorization', `Bearer ${adminToken}`);

    const targetEmp = getRes.body.data[0];
    const initialStatus = targetEmp.isEffectiveAdmin;

    // Toggle status
    const toggleRes = await request(app)
      .post('/api/admin-management/toggle-admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ empId: targetEmp.empId, makeAdmin: !initialStatus });

    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.success).toBe(true);

    // Verify change in GET
    const verifyRes = await request(app)
      .get('/api/admin-management/users')
      .set('Authorization', `Bearer ${adminToken}`);

    const updatedEmp = verifyRes.body.data.find(f => f.empId === targetEmp.empId);
    expect(updatedEmp.isEffectiveAdmin).toBe(!initialStatus);

    // Revert back
    await request(app)
      .post('/api/admin-management/toggle-admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ empId: targetEmp.empId, makeAdmin: initialStatus });
  });

  test('GET /api/admin-management/users excludes faculty relieved before the academic period', async () => {
    // Create a temporary faculty member relieved prior to 2026-2027 periodStart
    const TEST_RELIEVED_ID = 'TEST_ADM_RELIEVED_99';
    await Faculty.deleteMany({ empId: TEST_RELIEVED_ID });
    await Faculty.create({
      empId: TEST_RELIEVED_ID,
      name: 'Dr. Relieved Faculty',
      designation: 'Associate Professor',
      department: 'CSE',
      relievingDate: new Date('2025-01-01'), // Relieved in 2025
      isDeleted: false,
    });

    const res = await request(app)
      .get('/api/admin-management/users?academicYear=2026-2027&semester=ODD')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const found = res.body.data.find(f => f.empId === TEST_RELIEVED_ID);
    expect(found).toBeUndefined();

    await Faculty.deleteMany({ empId: TEST_RELIEVED_ID });
  });

  test('GET /api/admin-management/users excludes faculty joining after the academic period ends', async () => {
    const TEST_FUTURE_ID = 'TEST_ADM_FUTURE_99';
    await Faculty.deleteMany({ empId: TEST_FUTURE_ID });
    await Faculty.create({
      empId: TEST_FUTURE_ID,
      name: 'Dr. Future Faculty',
      designation: 'Assistant Professor',
      department: 'CSE',
      joiningDate: new Date('2028-06-01'), // Joins in 2028
      isDeleted: false,
    });

    const res = await request(app)
      .get('/api/admin-management/users?academicYear=2026-2027&semester=ODD')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const found = res.body.data.find(f => f.empId === TEST_FUTURE_ID);
    expect(found).toBeUndefined();

    await Faculty.deleteMany({ empId: TEST_FUTURE_ID });
  });

  test('GET /api/admin-management/users guarantees distinct faculty by empId with 0 duplicates', async () => {
    const res = await request(app)
      .get('/api/admin-management/users?academicYear=2026-2027&semester=ODD')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const facultyList = res.body.data;
    const empIds = facultyList.map(f => f.empId);
    const distinctEmpIds = new Set(empIds);

    expect(distinctEmpIds.size).toBe(facultyList.length);
  });
});
