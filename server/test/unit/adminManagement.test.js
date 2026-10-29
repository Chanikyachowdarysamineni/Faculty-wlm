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
});
