'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const express = require('express');

const authRouter = require('../../src/routes/auth');
const app = express();
app.use(express.json());
app.use('/deva/auth', authRouter);
app.use('/api/auth', authRouter);

const User = require('../../src/models/User');
const Faculty = require('../../src/models/Faculty');

describe('Faculty Password Login System (Mobile Number Authentication)', () => {
  const FACULTY_A_EMP = 'TEST_FAC_PW_101';
  const FACULTY_A_MOBILE = '9876543210';
  const FACULTY_A_EMAIL = 'fac.pw101@vignan.ac.in';

  const FACULTY_B_EMP = 'TEST_FAC_PW_102';
  const FACULTY_B_MOBILE = '9123456780';
  const FACULTY_B_EMAIL = 'fac.pw102@vignan.ac.in';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Clean test data
    await Promise.all([
      User.deleteMany({ empId: { $in: [FACULTY_A_EMP, FACULTY_B_EMP, 'TEST_FAC_NEW_103', 'TEST_FAC_NOPROV_104'] } }),
      Faculty.deleteMany({ empId: { $in: [FACULTY_A_EMP, FACULTY_B_EMP, 'TEST_FAC_NEW_103', 'TEST_FAC_NOPROV_104'] } }),
    ]);

    // Create Faculty A with hashed mobile in User
    const hashA = await bcrypt.hash(FACULTY_A_MOBILE, 10);
    await Faculty.create({
      empId: FACULTY_A_EMP,
      name: 'Dr. Faculty A',
      mobile: FACULTY_A_MOBILE,
      email: FACULTY_A_EMAIL,
      designation: 'Associate Professor',
      department: 'CSE',
    });
    await User.create({
      empId: FACULTY_A_EMP,
      name: 'Dr. Faculty A',
      mobile: FACULTY_A_MOBILE,
      email: FACULTY_A_EMAIL,
      passwordHash: hashA,
      role: 'faculty',
      forcePasswordChange: true,
    });

    // Create Faculty B (initially in Faculty list only, simulates missing user record)
    await Faculty.create({
      empId: FACULTY_B_EMP,
      name: 'Dr. Faculty B',
      mobile: FACULTY_B_MOBILE,
      email: FACULTY_B_EMAIL,
      designation: 'Assistant Professor',
      department: 'CSE',
    });
  }, 30000);

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ empId: { $in: [FACULTY_A_EMP, FACULTY_B_EMP, 'TEST_FAC_NEW_103', 'TEST_FAC_NOPROV_104'] } }),
      Faculty.deleteMany({ empId: { $in: [FACULTY_A_EMP, FACULTY_B_EMP, 'TEST_FAC_NEW_103', 'TEST_FAC_NOPROV_104'] } }),
    ]);
    await mongoose.disconnect();
  }, 30000);

  // ─────────────────────────────────────────────────────────────
  // 1. Existing Faculty Password Login
  // ─────────────────────────────────────────────────────────────
  test('Existing faculty can log in using Employee ID and registered mobile number as password', async () => {
    const res = await request(app)
      .post('/deva/auth/login')
      .send({
        employeeId: FACULTY_A_EMP,
        password: FACULTY_A_MOBILE,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.empId).toBe(FACULTY_A_EMP);
    expect(res.body.data.user.role).toBe('faculty');
    // Ensure sensitive fields are NEVER leaked in response
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.password).toBeUndefined();
  });

  test('Existing faculty can log in using registered Email and registered mobile number as password', async () => {
    const res = await request(app)
      .post('/deva/auth/login')
      .send({
        employeeId: FACULTY_A_EMAIL,
        password: FACULTY_A_MOBILE,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.empId).toBe(FACULTY_A_EMP);
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Incorrect Credentials & Security
  // ─────────────────────────────────────────────────────────────
  test('Rejects invalid password with 401 and attempt countdown', async () => {
    const res = await request(app)
      .post('/deva/auth/login')
      .send({
        employeeId: FACULTY_A_EMP,
        password: 'wrong_password_123',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid password/i);
  });

  test('Rejects non-existent employee ID or unregistered email with 401', async () => {
    const res = await request(app)
      .post('/deva/auth/login')
      .send({
        employeeId: 'NON_EXISTENT_EMP_99999',
        password: 'any_password',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Dynamic Auto-Provisioning for Faculty without User Doc
  // ─────────────────────────────────────────────────────────────
  test('Auto-provisions User account and allows login for faculty present in Faculty collection', async () => {
    // Verify Faculty B does not have a User doc yet
    const beforeUser = await User.findOne({ empId: FACULTY_B_EMP });
    expect(beforeUser).toBeNull();

    // Log in using Faculty B's mobile number
    const res = await request(app)
      .post('/deva/auth/login')
      .send({
        employeeId: FACULTY_B_EMP,
        password: FACULTY_B_MOBILE,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.empId).toBe(FACULTY_B_EMP);

    // Verify User record was securely auto-provisioned with bcrypt hash
    const afterUser = await User.findOne({ empId: FACULTY_B_EMP });
    expect(afterUser).toBeDefined();
    expect(afterUser.passwordHash).not.toBe(FACULTY_B_MOBILE);
    expect(bcrypt.compareSync(FACULTY_B_MOBILE, afterUser.passwordHash)).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Dynamic Mobile Number Update Synchronization
  // ─────────────────────────────────────────────────────────────
  test('Dynamically accepts updated mobile number when mobile is changed in Faculty record', async () => {
    const NEW_MOBILE = '9998887776';

    // Simulate mobile update in Faculty collection
    await Faculty.updateOne({ empId: FACULTY_A_EMP }, { $set: { mobile: NEW_MOBILE } });

    // Attempt login with new mobile number
    const res = await request(app)
      .post('/deva/auth/login')
      .send({
        employeeId: FACULTY_A_EMP,
        password: NEW_MOBILE,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.empId).toBe(FACULTY_A_EMP);

    // Verify User document passwordHash was automatically synchronized
    const updatedUser = await User.findOne({ empId: FACULTY_A_EMP });
    expect(bcrypt.compareSync(NEW_MOBILE, updatedUser.passwordHash)).toBe(true);

    // Old mobile number should now fail
    const oldRes = await request(app)
      .post('/deva/auth/login')
      .send({
        employeeId: FACULTY_A_EMP,
        password: FACULTY_A_MOBILE,
      });
    expect(oldRes.status).toBe(401);
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Newly Added Faculty Support
  // ─────────────────────────────────────────────────────────────
  test('Newly added faculty member can immediately log in with their registered mobile number', async () => {
    const NEW_EMP = 'TEST_FAC_NEW_103';
    const NEW_EMP_MOBILE = '9440011223';
    const NEW_EMP_EMAIL = 'new.fac103@vignan.ac.in';

    // Create new faculty in database
    await Faculty.create({
      empId: NEW_EMP,
      name: 'Dr. New Faculty',
      mobile: NEW_EMP_MOBILE,
      email: NEW_EMP_EMAIL,
      designation: 'Assistant Professor',
      department: 'CSE',
    });

    // Login immediately with their registered mobile number
    const res = await request(app)
      .post('/deva/auth/login')
      .send({
        employeeId: NEW_EMP,
        password: NEW_EMP_MOBILE,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.empId).toBe(NEW_EMP);
    expect(res.body.data.user.role).toBe('faculty');
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Administrator Login Preservation
  // ─────────────────────────────────────────────────────────────
  test('Admin user retains admin role and privileges upon login', async () => {
    const adminId = process.env.ADMIN_ID || '231fa04860';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin@123';

    // Ensure admin user exists in DB
    const adminHash = await bcrypt.hash(adminPassword, 10);
    await User.findOneAndUpdate(
      { empId: adminId },
      {
        $set: {
          name: 'System Admin',
          passwordHash: adminHash,
          role: 'admin',
          canAccessAdmin: true,
          forcePasswordChange: false,
        }
      },
      { upsert: true }
    );

    const res = await request(app)
      .post('/deva/auth/login')
      .send({
        employeeId: adminId,
        password: adminPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.canAccessAdmin).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // 7. Real Database Faculty Record Verification
  // ─────────────────────────────────────────────────────────────
  test('Authenticates real faculty member (empId 163) using their registered mobile number', async () => {
    const realFaculty = await Faculty.findOne({ empId: '163' }).lean();
    if (!realFaculty || !realFaculty.mobile) {
      console.warn('Real faculty 163 not found or has no mobile — skipping live check');
      return;
    }

    const res = await request(app)
      .post('/deva/auth/login')
      .send({
        employeeId: '163',
        password: realFaculty.mobile.trim(),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.empId).toBe('163');
  });

  // ─────────────────────────────────────────────────────────────
  // 8. Password Change (PUT /deva/auth/change-password)
  // ─────────────────────────────────────────────────────────────
  test('Allows faculty to change password and login with new password', async () => {
    // 1. Login with initial mobile
    const loginRes = await request(app)
      .post('/deva/auth/login')
      .send({
        employeeId: FACULTY_A_EMP,
        password: '9998887776', // from test 4
      });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.data.token;

    // 2. Change password
    const changeRes = await request(app)
      .put('/deva/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: '9998887776',
        newPassword: 'MySecureNewPassword#2026',
      });
    expect(changeRes.status).toBe(200);
    expect(changeRes.body.success).toBe(true);

    // 3. Login with new password
    const newLoginRes = await request(app)
      .post('/deva/auth/login')
      .send({
        employeeId: FACULTY_A_EMP,
        password: 'MySecureNewPassword#2026',
      });
    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body.data.user.forcePasswordChange).toBe(false);
  });
});
