'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const authRouter = require('../../src/routes/auth');
const User = require('../../src/models/User');
const Faculty = require('../../src/models/Faculty');
const PasswordResetToken = require('../../src/models/PasswordResetToken');
const EmailJob = require('../../src/models/EmailJob');
const emailQueue = require('../../src/services/emailQueue');

const app = express();
app.use(express.json());
app.use('/deva/auth', authRouter);
app.use('/api/auth', authRouter);

describe('Forgot Password, Reset Password, and Change Password System', () => {
  const TEST_EMP_ID = 'TEST_FACULTY_FORGOT_01';
  const TEST_EMAIL = 'test.faculty.forgot01@vignan.ac.in';
  const TEST_MOBILE = '9876543210';
  let initialPasswordHash;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    initialPasswordHash = await bcrypt.hash(TEST_MOBILE, 10);

    // Clean up any existing records
    await Promise.all([
      User.deleteMany({ empId: { $in: [TEST_EMP_ID, 'NEW_FACULTY_02'] } }),
      Faculty.deleteMany({ empId: { $in: [TEST_EMP_ID, 'NEW_FACULTY_02'] } }),
      PasswordResetToken.deleteMany({ empId: { $in: [TEST_EMP_ID, 'NEW_FACULTY_02'] } }),
      EmailJob.deleteMany({ empId: { $in: [TEST_EMP_ID, 'NEW_FACULTY_02'] } }),
    ]);

    // Create test faculty and user
    await Faculty.create({
      empId: TEST_EMP_ID,
      name: 'Dr. Test Forgot Password',
      designation: 'Associate Professor',
      department: 'CSE',
      email: TEST_EMAIL,
      mobile: TEST_MOBILE,
    });

    await User.create({
      empId: TEST_EMP_ID,
      name: 'Dr. Test Forgot Password',
      designation: 'Associate Professor',
      email: TEST_EMAIL,
      mobile: TEST_MOBILE,
      passwordHash: initialPasswordHash,
      role: 'faculty',
    });
  }, 30000);

  afterAll(async () => {
    try {
      await Promise.all([
        User.deleteMany({ empId: { $in: [TEST_EMP_ID, 'NEW_FACULTY_02'] } }),
        Faculty.deleteMany({ empId: { $in: [TEST_EMP_ID, 'NEW_FACULTY_02'] } }),
        PasswordResetToken.deleteMany({ empId: { $in: [TEST_EMP_ID, 'NEW_FACULTY_02'] } }),
        EmailJob.deleteMany({ empId: { $in: [TEST_EMP_ID, 'NEW_FACULTY_02'] } }),
      ]);
      await mongoose.disconnect();
    } catch {}
  }, 30000);

  beforeEach(async () => {
    await emailQueue.stopWorker();
    await PasswordResetToken.deleteMany({ empId: { $in: [TEST_EMP_ID, 'NEW_FACULTY_02'] } });
    await EmailJob.deleteMany({ empId: { $in: [TEST_EMP_ID, 'NEW_FACULTY_02'] } });
  });

  // ─────────────────────────────────────────────────────────────
  // 1. FORGOT PASSWORD TESTS
  // ─────────────────────────────────────────────────────────────
  describe('POST /api/auth/forgot-password', () => {
    test('Successfully requests reset with valid Employee ID and enqueues branded email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ employeeId: TEST_EMP_ID });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.maskedEmail).toContain('@vignan.ac.in');
      expect(res.body.data.expiryMinutes).toBe(15);

      // Verify token created in database
      const tokenDoc = await PasswordResetToken.findOne({ empId: TEST_EMP_ID, usedAt: null });
      expect(tokenDoc).toBeDefined();
      expect(tokenDoc.codeHash).toBeDefined();
      expect(tokenDoc.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Verify email job enqueued
      const emailJob = await EmailJob.findOne({ empId: TEST_EMP_ID, type: 'password_reset' });
      expect(emailJob).toBeDefined();
      expect(emailJob.to).toBe(TEST_EMAIL.toLowerCase());
      expect(emailJob.subject).toContain('Password Reset Request');
      expect(emailJob.html).toContain('Department of Computer Science &amp; Engineering');
      expect(emailJob.html).toContain('VFSTR');
    });

    test('Successfully requests reset using registered email address as identifier', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ employeeId: TEST_EMAIL });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.empId).toBe(TEST_EMP_ID);
    });

    test('Account enumeration protection: returns success without revealing non-existence for unknown ID', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ employeeId: 'UNKNOWN_NONEXISTENT_USER_9999' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('If an account is associated with this identifier');

      // Ensure no reset token was created
      const count = await PasswordResetToken.countDocuments({ empId: 'UNKNOWN_NONEXISTENT_USER_9999' });
      expect(count).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. RESET PASSWORD TESTS (WITH 6-DIGIT CODE AND TOKEN)
  // ─────────────────────────────────────────────────────────────
  describe('POST /api/auth/reset-password', () => {
    test('Resets password successfully using 6-digit verification code and dispatches change notification', async () => {
      // Create a reset request
      const { resetCode } = await PasswordResetToken.createReset(TEST_EMP_ID, 15);

      const NEW_SECURE_PASS = 'NewSecurePass@2026';
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          employeeId: TEST_EMP_ID,
          code: resetCode,
          newPassword: NEW_SECURE_PASS,
          confirmPassword: NEW_SECURE_PASS,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.account).toBe(TEST_EMP_ID);
      expect(res.body.data.changedAt).toBeDefined();

      // Verify token is now marked as used
      const usedDoc = await PasswordResetToken.findOne({ empId: TEST_EMP_ID, usedAt: { $ne: null } });
      expect(usedDoc).toBeDefined();

      // Verify new password works for login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ employeeId: TEST_EMP_ID, password: NEW_SECURE_PASS });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.token).toBeDefined();

      // Verify old password (mobile number) is rejected
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ employeeId: TEST_EMP_ID, password: TEST_MOBILE });

      expect(oldLoginRes.status).toBe(401);

      // Verify email notification enqueued with exact VFSTR branding
      const notifyEmail = await EmailJob.findOne({ empId: TEST_EMP_ID, type: 'notification' });
      expect(notifyEmail).toBeDefined();
      expect(notifyEmail.subject).toBe('Your Password Has Been Changed Successfully – Department of CSE');
      expect(notifyEmail.text).toContain('Vignan’s Foundation for Science, Technology and Research (VFSTR)');
      expect(notifyEmail.text).toContain('Department of Computer Science and Engineering (CSE)');
      expect(notifyEmail.text).toContain('Please take a screenshot of your new password');
      expect(notifyEmail.text).toContain('CSE Developers Batch 2023–2027');
      expect(notifyEmail.text).not.toContain(NEW_SECURE_PASS); // Password must NEVER be in email
    });

    test('Rejects reset attempt when new password and confirmation mismatch', async () => {
      const { resetCode } = await PasswordResetToken.createReset(TEST_EMP_ID, 15);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          employeeId: TEST_EMP_ID,
          code: resetCode,
          newPassword: 'ValidPass1234!',
          confirmPassword: 'MismatchPass5678!',
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/mismatch|do not match/i);
    });

    test('Prevents reuse of already-used reset token', async () => {
      const { resetCode } = await PasswordResetToken.createReset(TEST_EMP_ID, 15);

      // First use succeeds
      const res1 = await request(app)
        .post('/api/auth/reset-password')
        .send({
          employeeId: TEST_EMP_ID,
          code: resetCode,
          newPassword: 'FirstPassword123!',
        });
      expect(res1.status).toBe(200);

      // Second use with same code fails
      const res2 = await request(app)
        .post('/api/auth/reset-password')
        .send({
          employeeId: TEST_EMP_ID,
          code: resetCode,
          newPassword: 'SecondPassword456!',
        });
      expect(res2.status).toBe(400);
      expect(JSON.stringify(res2.body)).toMatch(/already been used|expired|not found|No active password reset/i);
    });

    test('Rejects expired reset tokens', async () => {
      // Create token expired in the past
      const { rawToken } = await PasswordResetToken.createReset(TEST_EMP_ID, -5); // -5 minutes

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'ExpiredTestPass123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/expired|invalid/i);
    });

    test('Enforces brute-force lockout after 5 incorrect code attempts', async () => {
      await PasswordResetToken.createReset(TEST_EMP_ID, 15);

      // Submit 5 wrong guesses
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/auth/reset-password')
          .send({
            employeeId: TEST_EMP_ID,
            code: '000000',
            newPassword: 'SomePassword123!',
          });
        expect(res.status).toBe(400);
      }

      // 6th attempt should state too many attempts / locked
      const finalRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          employeeId: TEST_EMP_ID,
          code: '000000',
          newPassword: 'SomePassword123!',
        });
      expect(finalRes.status).toBe(400);
      expect(finalRes.body.message).toMatch(/too many|request a new/i);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. CHANGE PASSWORD TESTS (AUTHENTICATED PROFILE PAGE)
  // ─────────────────────────────────────────────────────────────
  describe('PUT /api/auth/change-password', () => {
    let facultyToken;

    beforeEach(async () => {
      // Ensure user has initial password hash
      await User.updateOne({ empId: TEST_EMP_ID }, { $set: { passwordHash: initialPasswordHash, tokenVersion: 0 } });

      facultyToken = jwt.sign(
        { id: TEST_EMP_ID, empId: TEST_EMP_ID, role: 'faculty', tokenVersion: 0 },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h', algorithm: 'HS256' }
      );
    });

    test('Rejects change password if current password is wrong', async () => {
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          currentPassword: 'WrongPassword999',
          newPassword: 'MyNewStrongPass@1',
          confirmPassword: 'MyNewStrongPass@1',
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Current password is incorrect');
    });

    test('Successfully changes password with valid current password and sends branded email', async () => {
      const NEW_PASSWORD = 'BrandNewPassword@2026';
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          currentPassword: TEST_MOBILE,
          newPassword: NEW_PASSWORD,
          confirmPassword: NEW_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.account).toBe(TEST_EMP_ID);
      expect(res.body.data.changedAt).toBeDefined();

      // Verify email notification enqueued
      const emailJob = await EmailJob.findOne({ empId: TEST_EMP_ID, type: 'notification' }).sort({ createdAt: -1 });
      expect(emailJob).toBeDefined();
      expect(emailJob.subject).toBe('Your Password Has Been Changed Successfully – Department of CSE');
      expect(emailJob.text).toContain(`Account: ${TEST_EMP_ID}`);
      expect(emailJob.text).toContain('Vignan’s Foundation for Science, Technology and Research (VFSTR)');
      expect(emailJob.text).toContain('Regards from the CSE Developers Batch 2023–2027');

      // Verify user can log in with new password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ employeeId: TEST_EMP_ID, password: NEW_PASSWORD });
      expect(loginRes.status).toBe(200);

      // Verify old password is rejected
      const oldLogin = await request(app)
        .post('/api/auth/login')
        .send({ employeeId: TEST_EMP_ID, password: TEST_MOBILE });
      expect(oldLogin.status).toBe(401);
    });

    test('Works seamlessly for newly added faculty using their registered mobile number', async () => {
      const NEW_FACULTY_ID = 'NEW_FACULTY_02';
      const NEW_FACULTY_EMAIL = 'new.faculty02@vignan.ac.in';
      const NEW_FACULTY_MOBILE = '9123456780';

      // Admin adds faculty in Faculty list
      await Faculty.create({
        empId: NEW_FACULTY_ID,
        name: 'Prof. Newly Added',
        designation: 'Assistant Professor',
        email: NEW_FACULTY_EMAIL,
        mobile: NEW_FACULTY_MOBILE,
      });

      // User first logs in using registered mobile
      const firstLogin = await request(app)
        .post('/api/auth/login')
        .send({ employeeId: NEW_FACULTY_ID, password: NEW_FACULTY_MOBILE });

      expect(firstLogin.status).toBe(200);
      const newAuthToken = firstLogin.body.data.token;

      // User changes password from Profile page
      const changeRes = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${newAuthToken}`)
        .send({
          currentPassword: NEW_FACULTY_MOBILE,
          newPassword: 'NewPersonalSecret#9',
          confirmPassword: 'NewPersonalSecret#9',
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // Check notification sent to the new faculty's email
      const job = await EmailJob.findOne({ empId: NEW_FACULTY_ID, type: 'notification' });
      expect(job).toBeDefined();
      expect(job.to).toBe(NEW_FACULTY_EMAIL.toLowerCase());
      expect(job.subject).toBe('Your Password Has Been Changed Successfully – Department of CSE');
    });
  });
});
