'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const emailQueue = require('../../src/services/emailQueue');
const EmailJob = require('../../src/models/EmailJob');
const OtpToken = require('../../src/models/OtpToken');
const User = require('../../src/models/User');
const Faculty = require('../../src/models/Faculty');

describe('OTP Email Delivery & Durable Queue Service', () => {
  const TEST_EMP_ID = 'test_faculty_otp_9999';
  const TEST_EMAIL = 'test.faculty9999@vignan.ac.in';
  const TEST_LINKED_EMP_ID = 'test_faculty_linked_8888';
  const TEST_LINKED_EMAIL = 'test.linked8888@vignan.ac.in';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }

    // Clean any previous test data
    await Promise.all([
      EmailJob.deleteMany({ empId: { $in: [TEST_EMP_ID, TEST_LINKED_EMP_ID] } }),
      OtpToken.deleteMany({ empId: { $in: [TEST_EMP_ID, TEST_LINKED_EMP_ID] } }),
      User.deleteMany({ empId: { $in: [TEST_EMP_ID, TEST_LINKED_EMP_ID] } }),
      Faculty.deleteMany({ empId: { $in: [TEST_EMP_ID, TEST_LINKED_EMP_ID] } }),
    ]);

    // Create test user and faculty records
    await User.create({
      empId: TEST_EMP_ID,
      name: 'Dr. Test Faculty',
      email: TEST_EMAIL,
      passwordHash: 'dummyHashForTesting',
      role: 'faculty',
    });

    await Faculty.create({
      empId: TEST_EMP_ID,
      name: 'Dr. Test Faculty',
      email: TEST_EMAIL,
      designation: 'Associate Professor',
    });

    await User.create({
      empId: TEST_LINKED_EMP_ID,
      name: 'Dr. Linked Faculty',
      email: TEST_LINKED_EMAIL,
      passwordHash: 'dummyHashForTesting',
      role: 'faculty',
    });

    await Faculty.create({
      empId: TEST_LINKED_EMP_ID,
      name: 'Dr. Linked Faculty',
      email: TEST_LINKED_EMAIL,
      designation: 'Professor',
    });
  }, 30000);

  afterAll(async () => {
    // Clean test data and stop workers
    await emailQueue.stopWorker();
    await Promise.all([
      EmailJob.deleteMany({ empId: { $in: [TEST_EMP_ID, TEST_LINKED_EMP_ID] } }),
      OtpToken.deleteMany({ empId: { $in: [TEST_EMP_ID, TEST_LINKED_EMP_ID] } }),
      User.deleteMany({ empId: { $in: [TEST_EMP_ID, TEST_LINKED_EMP_ID] } }),
      Faculty.deleteMany({ empId: { $in: [TEST_EMP_ID, TEST_LINKED_EMP_ID] } }),
    ]);
    await mongoose.disconnect();
  }, 30000);

  beforeEach(async () => {
    await emailQueue.stopWorker();
    await EmailJob.deleteMany({ empId: { $in: [TEST_EMP_ID, TEST_LINKED_EMP_ID] } });
    await OtpToken.deleteMany({ empId: { $in: [TEST_EMP_ID, TEST_LINKED_EMP_ID] } });
  });

  // ─────────────────────────────────────────────────────────────
  // 1. Error Classification Tests
  // ─────────────────────────────────────────────────────────────
  describe('Error Classification', () => {
    test('Correctly classifies 550 5.1.1 permanent mailbox not found error', () => {
      const err = new Error('550 5.1.1 The email account that you tried to reach does not exist');
      err.responseCode = 550;
      const result = emailQueue.classifyError(err);
      expect(result.isPermanent).toBe(true);
      expect(result.category).toBe('INVALID_RECIPIENT');
      expect(result.enhancedCode).toBe('5.1.1');
    });

    test('Correctly classifies 550 5.4.5 daily user sending limit exceeded error', () => {
      const err = new Error('Data command failed: 550-5.4.5 Daily user sending limit exceeded. For more information on Gmail sending limits go to https://support.google.com/a/answer/166852');
      err.responseCode = 550;
      err.code = 'EENVELOPE';
      const result = emailQueue.classifyError(err);
      expect(result.isQuotaExceeded).toBe(true);
      expect(result.category).toBe('PROVIDER_QUOTA_EXCEEDED');
      expect(result.enhancedCode).toBe('5.4.5');
      expect(result.userMessage).toContain('sending limits');
    });

    test('Correctly classifies 550 5.7.26 SPF / DKIM authentication rejection', () => {
      const err = new Error('550 5.7.26 This message does not pass authentication checks (SPF and DKIM)');
      err.responseCode = 550;
      const result = emailQueue.classifyError(err);
      expect(result.isPermanent).toBe(true);
      expect(result.category).toBe('POLICY_REJECTION');
      expect(result.enhancedCode).toBe('5.7.26');
    });

    test('Correctly classifies invalid recipient / mailbox unavailable error', () => {
      const err = new Error('Recipient address rejected: user not found');
      const result = emailQueue.classifyError(err);
      expect(result.isPermanent).toBe(true);
      expect(result.category).toBe('INVALID_RECIPIENT');
    });

    test('Correctly classifies 421 / 429 transient provider throttling', () => {
      const err421 = new Error('421 4.7.0 Try again later');
      err421.responseCode = 421;
      expect(emailQueue.classifyError(err421).isPermanent).toBe(false);
      expect(emailQueue.classifyError(err421).category).toBe('TRANSIENT');

      const err429 = new Error('429 Too many requests');
      err429.responseCode = 429;
      expect(emailQueue.classifyError(err429).isPermanent).toBe(false);

      const timeoutErr = new Error('Connection timed out');
      timeoutErr.code = 'ETIMEDOUT';
      expect(emailQueue.classifyError(timeoutErr).isPermanent).toBe(false);

      const resetErr = new Error('read ECONNRESET');
      resetErr.code = 'ECONNRESET';
      expect(emailQueue.classifyError(resetErr).isPermanent).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Exponential Backoff with Jitter Tests
  // ─────────────────────────────────────────────────────────────
  describe('Exponential Backoff & Jitter', () => {
    test('Calculates bounded exponential backoff with positive jitter', () => {
      const delay1 = emailQueue.calculateBackoff(1);
      const delay2 = emailQueue.calculateBackoff(2);
      const delay3 = emailQueue.calculateBackoff(3);

      // Attempt 1: 2000ms base + 0..1000ms jitter
      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay1).toBeLessThanOrEqual(3000);

      // Attempt 2: 4000ms base + 0..1000ms jitter
      expect(delay2).toBeGreaterThanOrEqual(4000);
      expect(delay2).toBeLessThanOrEqual(5000);

      // Attempt 3: 8000ms base + 0..1000ms jitter
      expect(delay3).toBeGreaterThanOrEqual(8000);
      expect(delay3).toBeLessThanOrEqual(9000);

      // Attempt 10: capped at 60000ms + 1000ms jitter
      const delay10 = emailQueue.calculateBackoff(10);
      expect(delay10).toBeLessThanOrEqual(61000);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Durable Enqueue & Delivery Tracking
  // ─────────────────────────────────────────────────────────────
  describe('Queue Ingestion & Dispatch', () => {
    test('Enqueues an OTP email and updates OtpToken to queued state', async () => {
      const { raw, docId } = await OtpToken.createOtp(TEST_EMP_ID, 10);
      expect(raw).toHaveLength(6);

      const job = await emailQueue.enqueueEmail({
        type: 'otp',
        empId: TEST_EMP_ID,
        to: TEST_EMAIL,
        subject: 'Your Test OTP Code',
        text: `Your OTP is: ${raw}`,
        html: `<p>Your OTP is: ${raw}</p>`,
        otpTokenId: docId,
      });

      expect(job).toBeDefined();
      expect(job.status).toBe('pending');
      expect(job.attempts).toBe(0);

      const updatedOtp = await OtpToken.findById(docId);
      expect(['queued', 'processing']).toContain(updatedOtp.deliveryStatus);
    });

    test('Processes enqueued job successfully with mock transport', async () => {
      let sentMail = null;
      emailQueue.setMockTransport({
        sendMail: async (mailOptions) => {
          sentMail = mailOptions;
          return { messageId: 'test-msg-id-123' };
        },
      });

      const { raw, docId } = await OtpToken.createOtp(TEST_EMP_ID, 10);
      const job = await emailQueue.enqueueEmail({
        type: 'otp',
        empId: TEST_EMP_ID,
        to: TEST_EMAIL,
        subject: 'OTP Test Delivery',
        text: `OTP: ${raw}`,
        html: `<p>OTP: ${raw}</p>`,
        otpTokenId: docId,
      });

      // Claim and process
      const claimed = await emailQueue.claimNextJob();
      expect(claimed).toBeDefined();
      expect(claimed._id.toString()).toBe(job._id.toString());
      expect(claimed.status).toBe('processing');

      await emailQueue.processJob(claimed);

      expect(sentMail).toBeDefined();
      expect(sentMail.to).toBe(TEST_EMAIL);
      expect(sentMail.text).toContain(raw);

      const finalJob = await EmailJob.findById(job._id);
      expect(finalJob.status).toBe('sent');
      expect(finalJob.sentAt).toBeDefined();

      const finalOtp = await OtpToken.findById(docId);
      expect(finalOtp.deliveryStatus).toBe('sent');
      expect(finalOtp.deliveredAt).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Transient Failure & Retry Scheduling
  // ─────────────────────────────────────────────────────────────
  describe('Transient Failure Handling', () => {
    test('Schedules retry with exponential backoff on transient 421 SMTP error', async () => {
      emailQueue.setMockTransport({
        sendMail: async () => {
          const err = new Error('421 4.7.0 Service temporarily busy, closing transmission');
          err.responseCode = 421;
          throw err;
        },
      });

      const { docId } = await OtpToken.createOtp(TEST_EMP_ID, 10);
      const job = await emailQueue.enqueueEmail({
        type: 'otp',
        empId: TEST_EMP_ID,
        to: TEST_EMAIL,
        subject: 'Transient Test',
        text: 'Test',
        otpTokenId: docId,
      });

      const claimed = await emailQueue.claimNextJob();
      await emailQueue.processJob(claimed);

      const retriedJob = await EmailJob.findById(job._id);
      expect(retriedJob.status).toBe('pending'); // Reset to pending for retry
      expect(retriedJob.attempts).toBe(1);
      expect(retriedJob.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 1000);
      expect(retriedJob.lastError).toContain('421');

      const otpToken = await OtpToken.findById(docId);
      expect(otpToken.deliveryStatus).toBe('pending');
      expect(otpToken.deliveryError).toMatch(/Retrying/i);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Permanent Failure Handling
  // ─────────────────────────────────────────────────────────────
  describe('Permanent Failure Handling', () => {
    test('Immediately marks permanent 550 error as failed without retry', async () => {
      emailQueue.setMockTransport({
        sendMail: async () => {
          const err = new Error('550 5.1.1 User unknown / mailbox not found');
          err.responseCode = 550;
          throw err;
        },
      });

      const { docId } = await OtpToken.createOtp(TEST_EMP_ID, 10);
      const job = await emailQueue.enqueueEmail({
        type: 'otp',
        empId: TEST_EMP_ID,
        to: 'invalid-nonexistent-user@vignan.ac.in',
        subject: 'Permanent Error Test',
        text: 'Test',
        otpTokenId: docId,
      });

      const claimed = await emailQueue.claimNextJob();
      await emailQueue.processJob(claimed);

      const failedJob = await EmailJob.findById(job._id);
      expect(failedJob.status).toBe('failed');
      expect(failedJob.isPermanentError).toBe(true);
      expect(failedJob.lastError).toContain('550');

      const otpToken = await OtpToken.findById(docId);
      expect(otpToken.deliveryStatus).toBe('failed');
      expect(otpToken.deliveryError).toContain('rejected');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Stale Lock Recovery
  // ─────────────────────────────────────────────────────────────
  describe('Worker Crash & Stale Lock Recovery', () => {
    test('Re-claims job stuck in processing past the stale lock timeout', async () => {
      // Simulate crashed worker: job was locked 3 minutes ago
      const staleJob = await EmailJob.create({
        type: 'otp',
        empId: TEST_EMP_ID,
        to: TEST_EMAIL,
        subject: 'Crashed Worker Job',
        text: 'Test',
        status: 'processing',
        lockedAt: new Date(Date.now() - 180000), // 3 min ago (> 2 min timeout)
        lockedBy: 'crashed-worker-pid-999',
        attempts: 1,
      });

      // Claim next job should pick up this abandoned job
      const recovered = await emailQueue.claimNextJob();
      expect(recovered).toBeDefined();
      expect(recovered._id.toString()).toBe(staleJob._id.toString());
      expect(recovered.attempts).toBe(2);
      expect(recovered.lockedBy).not.toBe('crashed-worker-pid-999');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 7. Bulk Concurrent Enqueue & Controlled Processing
  // ─────────────────────────────────────────────────────────────
  describe('High-Volume Bulk Login Queueing', () => {
    test('Handles 50 simultaneous OTP queue requests without dropped jobs or race conditions', async () => {
      await emailQueue.stopWorker();
      let dispatchCount = 0;
      emailQueue.setMockTransport({
        sendMail: async () => {
          dispatchCount += 1;
          // Simulate network latency (20ms)
          await new Promise((r) => setTimeout(r, 20));
          return { messageId: `msg-${dispatchCount}` };
        },
      });

      const BULK_COUNT = 50;
      const enqueuePromises = [];

      for (let i = 0; i < BULK_COUNT; i++) {
        enqueuePromises.push(
          emailQueue.enqueueEmail({
            type: 'otp',
            empId: TEST_EMP_ID,
            to: `faculty_${i}@vignan.ac.in`,
            subject: `OTP Bulk Login #${i}`,
            text: `Your OTP is ${100000 + i}`,
          })
        );
      }

      const enqueuedJobs = await Promise.all(enqueuePromises);
      expect(enqueuedJobs).toHaveLength(BULK_COUNT);

      // Verify all 50 exist in database with pending or processing status
      const totalCreatedCount = await EmailJob.countDocuments({
        empId: TEST_EMP_ID,
        status: { $in: ['pending', 'processing', 'sent'] },
      });
      expect(totalCreatedCount).toBe(BULK_COUNT);

      // Run queue worker to drain all 50 jobs
      emailQueue.startWorker();

      // Wait for all 50 jobs to be processed
      const startTime = Date.now();
      while (Date.now() - startTime < 15000) {
        const sentCount = await EmailJob.countDocuments({
          empId: TEST_EMP_ID,
          status: 'sent',
        });
        if (sentCount === BULK_COUNT) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      await emailQueue.stopWorker();

      const finalSentCount = await EmailJob.countDocuments({
        empId: TEST_EMP_ID,
        status: 'sent',
      });
      expect(finalSentCount).toBe(BULK_COUNT);
      expect(dispatchCount).toBe(BULK_COUNT);
    }, 20000);
  });

  // ─────────────────────────────────────────────────────────────
  // 8. Queue Stats & Monitoring
  // ─────────────────────────────────────────────────────────────
  describe('Queue Monitoring & Stats', () => {
    test('Returns structured queue statistics with masked emails', async () => {
      await EmailJob.create({
        type: 'otp',
        empId: TEST_EMP_ID,
        to: 'confidential.faculty@vignan.ac.in',
        subject: 'Failed email test',
        status: 'failed',
        isPermanentError: true,
        lastError: 'Simulated failure',
        attempts: 5,
      });

      const stats = await emailQueue.getQueueStats();
      expect(stats).toBeDefined();
      expect(stats.counts).toBeDefined();
      expect(stats.counts.failed).toBeGreaterThanOrEqual(1);

      const recentFail = stats.recentFailures.find((f) => f.empId === TEST_EMP_ID);
      expect(recentFail).toBeDefined();
      // Verify email is properly masked
      expect(recentFail.toMasked).toMatch(/^co\*{3,6}@vignan\.ac\.in$/);
      // Verify no raw OTP is present in stats
      expect(JSON.stringify(stats)).not.toContain('confidential.faculty@vignan.ac.in');
    });
  });
});
