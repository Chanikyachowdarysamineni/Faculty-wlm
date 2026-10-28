'use strict';

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const os = require('os');
const EmailJob = require('../models/EmailJob');
const OtpToken = require('../models/OtpToken');
const logger = require('../utils/logger');

const WORKER_ID = `${os.hostname()}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
const DEFAULT_MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60000;
const STALE_LOCK_TIMEOUT_MS = 120000; // 2 minutes

class EmailQueueService {
  constructor() {
    this.mailTransport = null;
    this.workerRunning = false;
    this.isProcessing = false;
    this.activeWorkers = 0;
    this.maxConcurrency = parseInt(process.env.SMTP_CONCURRENCY || '2', 10);
    this.pollIntervalMs = parseInt(process.env.EMAIL_QUEUE_POLL_MS || '1000', 10);
    this.pollTimer = null;
    this.mockTransport = null; // Used for automated unit/load testing
  }

  /**
   * Return or initialize pooled Nodemailer transport
   */
  getTransport() {
    if (this.mockTransport) {
      return this.mockTransport;
    }

    if (this.mailTransport) {
      return this.mailTransport;
    }

    if (!process.env.SMTP_HOST) {
      return null;
    }

    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === 'true'
      : port === 465;

    const maxConnections = Number(process.env.SMTP_MAX_CONNECTIONS || 3);
    const maxMessages = Number(process.env.SMTP_MAX_MESSAGES || 100);
    const rateLimit = Number(process.env.SMTP_RATE_LIMIT || 5);

    this.mailTransport = nodemailer.createTransport({
      pool: true,
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      maxConnections,
      maxMessages,
      rateLimit,
      rateDelta: 1000,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    this.mailTransport.verify((err) => {
      if (err) {
        logger.warn('SMTP connection pre-warm notice', { error: err.message });
      } else {
        logger.info('SMTP connection pool initialized and verified successfully', {
          host: process.env.SMTP_HOST,
          port,
          maxConnections,
        });
      }
    });

    return this.mailTransport;
  }

  /**
   * Set mock transport for test suites
   */
  setMockTransport(transport) {
    this.mockTransport = transport;
  }

  /**
   * Classify whether an SMTP/network error is permanent or transient
   */
  classifyError(err) {
    if (!err) return { isPermanent: false, reason: 'unknown' };

    const msg = (err.message || '').toLowerCase();
    const code = String(err.responseCode || err.code || '');

    // Permanent 5xx errors (RFC 5321)
    if (code.startsWith('5') || [550, 551, 552, 553, 554, 501, 502, 503].includes(Number(code))) {
      return { isPermanent: true, reason: `Permanent SMTP failure (${code})` };
    }

    // Invalid email / recipient errors
    if (
      code === 'EENVELOPE' ||
      msg.includes('invalid recipient') ||
      msg.includes('user not found') ||
      msg.includes('no such user') ||
      msg.includes('recipient address rejected') ||
      msg.includes('mailbox unavailable')
    ) {
      return { isPermanent: true, reason: 'Invalid or rejected recipient address' };
    }

    // Authentication failures on server credentials
    if (code === 'EAUTH' || msg.includes('authentication failed') || msg.includes('bad credentials')) {
      return { isPermanent: true, reason: 'SMTP Authentication failure' };
    }

    // Transient errors: 4xx SMTP codes, 429 rate limit, timeouts, connection resets
    return { isPermanent: false, reason: 'Transient network/provider error' };
  }

  /**
   * Calculate exponential backoff with jitter
   */
  calculateBackoff(attempt) {
    const exponent = Math.max(0, attempt - 1);
    const expDelay = BASE_BACKOFF_MS * Math.pow(2, exponent);
    const cappedDelay = Math.min(MAX_BACKOFF_MS, expDelay);
    const jitter = Math.floor(Math.random() * 1000); // 0-1000ms random jitter
    return cappedDelay + jitter;
  }

  /**
   * Enqueue an email job into the durable database queue
   */
  async enqueueEmail({
    type = 'otp',
    empId,
    to,
    subject,
    text = '',
    html = '',
    otpTokenId = null,
    metadata = {},
  }) {
    if (!empId || !to || !subject) {
      throw new Error('empId, to, and subject are required to enqueue email.');
    }

    const job = await EmailJob.create({
      type,
      empId,
      to: to.trim().toLowerCase(),
      subject,
      text,
      html,
      otpTokenId,
      metadata,
      status: 'pending',
      attempts: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      nextAttemptAt: new Date(),
    });

    if (otpTokenId) {
      await OtpToken.updateOne(
        { _id: otpTokenId },
        { $set: { deliveryStatus: 'queued' } }
      ).catch((err) => {
        logger.warn('Failed to update OtpToken status to queued', { otpTokenId, error: err.message });
      });
    }

    logger.info('Email job enqueued', {
      jobId: job._id,
      empId,
      toMasked: this.maskEmail(to),
      type,
    });

    // Wake up worker loop immediately
    this.kickWorker();

    return job;
  }

  /**
   * Claim next eligible job atomically, including recovering stale locks
   */
  async claimNextJob() {
    const now = new Date();
    const staleCutoff = new Date(Date.now() - STALE_LOCK_TIMEOUT_MS);

    // Atomically find and claim one job
    const job = await EmailJob.findOneAndUpdate(
      {
        $or: [
          // Normal pending jobs ready for processing
          {
            status: 'pending',
            nextAttemptAt: { $lte: now },
          },
          // Recover crashed or interrupted jobs stuck in processing
          {
            status: 'processing',
            lockedAt: { $lte: staleCutoff },
          },
        ],
      },
      {
        $set: {
          status: 'processing',
          lockedAt: now,
          lockedBy: WORKER_ID,
        },
        $inc: { attempts: 1 },
      },
      {
        sort: { nextAttemptAt: 1, createdAt: 1 },
        new: true,
      }
    );

    return job;
  }

  /**
   * Send an individual job through the SMTP transport
   */
  async processJob(job) {
    const transport = this.getTransport();
    if (!transport) {
      const err = new Error('SMTP environment variables are not configured on the server.');
      await this.handleJobFailure(job, err, true);
      return;
    }

    const fromName = process.env.MAIL_FROM_NAME || 'VFSTR Faculty System';
    const fromEmail = process.env.SMTP_USER || 'no-reply@vignan.ac.in';

    try {
      if (job.otpTokenId) {
        await OtpToken.updateOne(
          { _id: job.otpTokenId },
          { $set: { deliveryStatus: 'processing' } }
        ).catch(() => {});
      }

      await transport.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        replyTo: fromEmail,
        to: job.to,
        subject: job.subject,
        text: job.text,
        html: job.html,
      });

      // Mark job as sent
      const completedAt = new Date();
      await EmailJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'sent',
            sentAt: completedAt,
            lockedAt: null,
            lockedBy: null,
            lastError: null,
          },
        }
      );

      if (job.otpTokenId) {
        await OtpToken.updateOne(
          { _id: job.otpTokenId },
          {
            $set: {
              deliveryStatus: 'sent',
              deliveredAt: completedAt,
              deliveryError: null,
            },
          }
        ).catch(() => {});
      }

      logger.info('Email job dispatched successfully', {
        jobId: job._id,
        empId: job.empId,
        toMasked: this.maskEmail(job.to),
        attempts: job.attempts,
      });
    } catch (sendErr) {
      const { isPermanent, reason } = this.classifyError(sendErr);
      await this.handleJobFailure(job, sendErr, isPermanent, reason);
    }
  }

  /**
   * Handle job delivery failures with backoff or permanent marking
   */
  async handleJobFailure(job, error, isPermanent = false, reason = '') {
    const errorMessage = error?.message || String(error);
    const hasExceededAttempts = job.attempts >= job.maxAttempts;

    if (isPermanent || hasExceededAttempts) {
      // Mark permanently failed
      await EmailJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'failed',
            isPermanentError: isPermanent,
            lastError: errorMessage,
            lockedAt: null,
            lockedBy: null,
          },
        }
      );

      if (job.otpTokenId) {
        await OtpToken.updateOne(
          { _id: job.otpTokenId },
          {
            $set: {
              deliveryStatus: 'failed',
              deliveryError: isPermanent ? `Permanent error: ${reason || errorMessage}` : 'Max delivery retry attempts exceeded',
            },
          }
        ).catch(() => {});
      }

      logger.error('Email job permanently failed', {
        jobId: job._id,
        empId: job.empId,
        toMasked: this.maskEmail(job.to),
        attempts: job.attempts,
        isPermanent,
        reason,
        error: errorMessage,
      });
    } else {
      // Schedule retry with exponential backoff & jitter
      const backoffMs = this.calculateBackoff(job.attempts);
      const nextAttemptAt = new Date(Date.now() + backoffMs);

      await EmailJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'pending',
            nextAttemptAt,
            lastError: errorMessage,
            lockedAt: null,
            lockedBy: null,
          },
        }
      );

      if (job.otpTokenId) {
        await OtpToken.updateOne(
          { _id: job.otpTokenId },
          {
            $set: {
              deliveryStatus: 'pending',
              deliveryError: `Retry scheduled (attempt ${job.attempts}/${job.maxAttempts}) in ${Math.round(backoffMs / 1000)}s: ${errorMessage}`,
            },
          }
        ).catch(() => {});
      }

      logger.warn('Email job transient failure; scheduled retry', {
        jobId: job._id,
        empId: job.empId,
        toMasked: this.maskEmail(job.to),
        attempts: job.attempts,
        nextAttemptAt,
        delayMs: backoffMs,
        error: errorMessage,
      });
    }
  }

  /**
   * Spawn concurrent worker tasks up to maxConcurrency
   */
  kickWorker() {
    if (!this.workerRunning) return;

    while (this.activeWorkers < this.maxConcurrency) {
      this.activeWorkers += 1;
      this.runWorkerTask()
        .finally(() => {
          this.activeWorkers -= 1;
        });
    }
  }

  /**
   * Continuous queue polling task
   */
  async runWorkerTask() {
    try {
      while (this.workerRunning) {
        let job = null;
        try {
          job = await this.claimNextJob();
        } catch (dbErr) {
          logger.error('Error claiming next email job from queue', { error: dbErr.message });
          break;
        }

        if (!job) {
          // No jobs ready right now
          break;
        }

        await this.processJob(job);
      }
    } catch (taskErr) {
      logger.error('Unexpected error in email worker task', { error: taskErr.message });
    }
  }

  /**
   * Start worker background interval
   */
  startWorker() {
    if (this.workerRunning) return;
    this.workerRunning = true;
    logger.info('Email queue worker started', {
      workerId: WORKER_ID,
      concurrency: this.maxConcurrency,
      pollIntervalMs: this.pollIntervalMs,
    });

    this.pollTimer = setInterval(() => {
      this.kickWorker();
    }, this.pollIntervalMs);

    // Initial kick
    this.kickWorker();
  }

  /**
   * Graceful stop of email worker
   */
  async stopWorker() {
    this.workerRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Wait briefly for active in-flight jobs to complete
    const startWait = Date.now();
    while (this.activeWorkers > 0 && Date.now() - startWait < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    logger.info('Email queue worker stopped gracefully', { workerId: WORKER_ID });
  }

  /**
   * Return queue statistics for monitoring and admin dashboards
   */
  async getQueueStats() {
    const [pending, processing, sent, failed, recentErrors] = await Promise.all([
      EmailJob.countDocuments({ status: 'pending' }),
      EmailJob.countDocuments({ status: 'processing' }),
      EmailJob.countDocuments({ status: 'sent' }),
      EmailJob.countDocuments({ status: 'failed' }),
      EmailJob.find({ status: 'failed' })
        .sort({ updatedAt: -1 })
        .limit(10)
        .select('empId to attempts lastError isPermanentError updatedAt')
        .lean(),
    ]);

    return {
      workerId: WORKER_ID,
      activeWorkers: this.activeWorkers,
      maxConcurrency: this.maxConcurrency,
      counts: {
        pending,
        processing,
        sent,
        failed,
        total: pending + processing + sent + failed,
      },
      recentFailures: recentErrors.map((f) => ({
        empId: f.empId,
        toMasked: this.maskEmail(f.to),
        attempts: f.attempts,
        lastError: f.lastError,
        isPermanentError: f.isPermanentError,
        failedAt: f.updatedAt,
      })),
    };
  }

  maskEmail(email = '') {
    if (!email || !email.includes('@')) return '';
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local[0] || '*'}*@${domain}`;
    }
    const visiblePrefix = local.slice(0, 2);
    const maskedLocal = visiblePrefix + '*'.repeat(Math.min(6, Math.max(3, local.length - 2)));
    return `${maskedLocal}@${domain}`;
  }
}

// Export singleton
const emailQueue = new EmailQueueService();
module.exports = emailQueue;
