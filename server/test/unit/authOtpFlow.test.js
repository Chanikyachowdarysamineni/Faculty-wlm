'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const authRouter = require('../../src/routes/auth');
const User = require('../../src/models/User');
const Faculty = require('../../src/models/Faculty');
const OtpToken = require('../../src/models/OtpToken');
const EmailJob = require('../../src/models/EmailJob');
const emailQueue = require('../../src/services/emailQueue');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth OTP Flow: Linked Emails, Cooldowns, & Verification', () => {
  const EMP_ID = 'test_auth_flow_7777';
  const LINKED_EMAIL = 'prof.flow7777@vignan.ac.in';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Set mock transport so real emails are not dispatched
    emailQueue.setMockTransport({
      sendMail: async () => ({ messageId: 'mock-auth-test-id' }),
    });

    await Promise.all([
      User.deleteMany({ empId: EMP_ID }),
      Faculty.deleteMany({ empId: EMP_ID }),
      OtpToken.deleteMany({ empId: EMP_ID }),
      EmailJob.deleteMany({ empId: EMP_ID }),
    ]);

    await User.create({
      empId: EMP_ID,
      name: 'Prof. Flow',
      email: LINKED_EMAIL,
      passwordHash: 'dummyHashedPassword',
      role: 'faculty',
      failedLoginAttempts: 0,
      lockUntil: null,
    });

    await Faculty.create({
      empId: EMP_ID,
      name: 'Prof. Flow',
      email: LINKED_EMAIL,
      designation: 'Assistant Professor',
    });
  }, 30000);

  afterAll(async () => {
    await emailQueue.stopWorker();
    await Promise.all([
      User.deleteMany({ empId: EMP_ID }),
      Faculty.deleteMany({ empId: EMP_ID }),
      OtpToken.deleteMany({ empId: EMP_ID }),
      EmailJob.deleteMany({ empId: EMP_ID }),
    ]);
    await mongoose.disconnect();
  }, 30000);

  beforeEach(async () => {
    await OtpToken.deleteMany({ empId: EMP_ID });
    await EmailJob.deleteMany({ empId: EMP_ID });
    await User.updateOne({ empId: EMP_ID }, { $set: { failedLoginAttempts: 0, lockUntil: null } });
  });

  // ─────────────────────────────────────────────────────────────
  // 1. Linked Email Resolution for OTP Send
  // ─────────────────────────────────────────────────────────────
  test('Requests OTP using verified linked email address instead of employee ID', async () => {
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({ employeeId: LINKED_EMAIL });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.empId).toBe(EMP_ID);
    expect(res.body.data.maskedEmail).toMatch(/^pr\*{3,6}@vignan\.ac\.in$/);

    // Verify EmailJob enqueued with correct recipient
    const job = await EmailJob.findOne({ empId: EMP_ID });
    expect(job).toBeDefined();
    expect(job.to).toBe(LINKED_EMAIL.toLowerCase());

    // Verify OtpToken created with canonical empId
    const otp = await OtpToken.findOne({ empId: EMP_ID });
    expect(otp).toBeDefined();
    expect(otp.deliveryStatus).toBe('queued');
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Cooldown Enforcement
  // ─────────────────────────────────────────────────────────────
  test('Blocks immediate duplicate OTP request within 60-second cooldown', async () => {
    // First request
    const firstRes = await request(app)
      .post('/api/auth/send-otp')
      .send({ employeeId: EMP_ID });
    expect(firstRes.status).toBe(200);

    // Immediate second request
    const secondRes = await request(app)
      .post('/api/auth/send-otp')
      .send({ employeeId: LINKED_EMAIL }); // Even when using linked email

    expect(secondRes.status).toBe(429);
    expect(secondRes.body.success).toBe(false);
    expect(secondRes.body.message).toContain('Please wait');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. OTP Verification with Linked Email & Single-Use Enforcement
  // ─────────────────────────────────────────────────────────────
  test('Verifies OTP using linked email, issues JWT, and invalidates token against replay', async () => {
    // Create an OTP directly
    const { raw } = await OtpToken.createOtp(EMP_ID, 10);

    // Verify using the linked email as identifier
    const verifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({
        employeeId: LINKED_EMAIL,
        otp: raw,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.token).toBeDefined();
    expect(verifyRes.body.data.user.empId).toBe(EMP_ID);

    // Replay attack prevention: attempting to reuse same OTP should fail immediately
    const replayRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({
        employeeId: LINKED_EMAIL,
        otp: raw,
      });

    expect(replayRes.status).toBe(400);
    expect(replayRes.body.success).toBe(false);
    expect(replayRes.body.message).toContain('expired or was not found');
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Bad OTP Guess Limiting & Account Protection
  // ─────────────────────────────────────────────────────────────
  test('Rejects invalid OTP, increments attempts, and locks account after 5 failed guesses', async () => {
    await OtpToken.createOtp(EMP_ID, 10);

    // Guess 1-4
    for (let guess = 1; guess <= 4; guess++) {
      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({ employeeId: EMP_ID, otp: '000000' });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain(`${5 - guess} attempt(s) remaining`);
    }

    // 5th guess triggers lock
    const lockRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ employeeId: EMP_ID, otp: '000000' });

    expect(lockRes.status).toBe(429);
    expect(lockRes.body.message).toContain('Account locked');

    // Verify user lockUntil is set in DB
    const user = await User.findOne({ empId: EMP_ID });
    expect(user.lockUntil).toBeDefined();
    expect(new Date(user.lockUntil).getTime()).toBeGreaterThan(Date.now());
  });
});
