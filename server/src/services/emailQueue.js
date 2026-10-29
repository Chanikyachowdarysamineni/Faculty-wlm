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
    this.fallbackTransport = null;
    this.autoTestMockTransport = null;
    this.workerRunning = false;
    this.isProcessing = false;
    this.activeWorkers = 0;
    this.maxConcurrency = parseInt(process.env.SMTP_CONCURRENCY || '2', 10);
    this.pollIntervalMs = parseInt(process.env.EMAIL_QUEUE_POLL_MS || '1000', 10);
    this.pollTimer = null;
    this.mockTransport = null; // Used for automated unit/load testing
  }

  /**
   * Parse configured sender details from environment
   */
  getFromAddress() {
    let fromName = process.env.MAIL_FROM_NAME || 'Faculty Workload Management';
    let fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER || 'no-reply@vignan.ac.in';

    // Parse SMTP_FROM if formatted as "Name" <email@domain.com>
    if (process.env.SMTP_FROM) {
      const match = process.env.SMTP_FROM.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
      if (match) {
        if (match[1]) fromName = match[1].trim();
        if (match[2]) fromEmail = match[2].trim();
      }
    }

    return {
      fromName,
      fromEmail,
      formatted: `"${fromName}" <${fromEmail}>`,
    };
  }

  /**
   * Return or initialize pooled Nodemailer transport
   */
  getTransport() {
    if (this.mockTransport) {
      return this.mockTransport;
    }

    // Protect live production SMTP quota from being consumed by automated test runs
    if (process.env.NODE_ENV === 'test' && !process.env.FORCE_REAL_SMTP_TEST) {
      if (!this.autoTestMockTransport) {
        this.autoTestMockTransport = {
          sendMail: async () => ({ messageId: `mock-test-${Date.now()}` }),
          verify: (cb) => cb(null, true),
        };
      }
      return this.autoTestMockTransport;
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
   * Return fallback SMTP transport if configured in .env
   */
  getFallbackTransport() {
    if (this.fallbackTransport) {
      return this.fallbackTransport;
    }

    if (!process.env.SMTP_FALLBACK_HOST || !process.env.SMTP_FALLBACK_USER) {
      return null;
    }

    const port = Number(process.env.SMTP_FALLBACK_PORT || 587);
    const secure = process.env.SMTP_FALLBACK_SECURE === 'true' || port === 465;

    this.fallbackTransport = nodemailer.createTransport({
      host: process.env.SMTP_FALLBACK_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_FALLBACK_USER,
        pass: process.env.SMTP_FALLBACK_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    logger.info('Fallback SMTP transport initialized', {
      host: process.env.SMTP_FALLBACK_HOST,
      port,
    });

    return this.fallbackTransport;
  }

  /**
   * Set mock transport for test suites
   */
  setMockTransport(transport) {
    this.mockTransport = transport;
  }

  /**
   * Classify whether an SMTP/network error is permanent or transient,
   * distinguishing quota limits, invalid recipients, policy blocks, and credentials.
   */
  classifyError(err) {
    if (!err) {
      return {
        isPermanent: false,
        isQuotaExceeded: false,
        category: 'UNKNOWN',
        enhancedCode: null,
        responseCode: null,
        reason: 'Unknown error',
        userMessage: 'An unexpected error occurred while delivering email.',
        adminAction: null,
      };
    }

    const msg = String(err.message || '').toLowerCase();
    const response = String(err.response || '').toLowerCase();
    const combined = `${msg} ${response}`;
    const responseCode = err.responseCode ? Number(err.responseCode) : null;
    const code = String(err.code || '');

    // Extract RFC 3463 Enhanced Status Code if present (e.g. 5.4.5, 5.1.1, 5.7.1)
    const enhancedMatch = `${err.response || ''} ${err.message || ''}`.match(/\b([45]\.\d{1,3}\.\d{1,3})\b/);
    const enhancedCode = enhancedMatch ? enhancedMatch[1] : null;

    // 1. PROVIDER DAILY SENDING LIMIT / QUOTA EXCEEDED
    // Gmail: 550 5.4.5 Daily user sending limit exceeded
    // Other providers: 452 4.5.3, 550 5.4.5, "quota exceeded", "sending limits", "rate limit"
    if (
      enhancedCode === '5.4.5' ||
      enhancedCode === '4.5.3' ||
      combined.includes('daily user sending limit exceeded') ||
      combined.includes('daily user sending quota exceeded') ||
      combined.includes('quota exceeded') ||
      combined.includes('daily sending limit') ||
      combined.includes('sending limits go to') ||
      combined.includes('too many messages') ||
      combined.includes('rate limit exceeded')
    ) {
      return {
        isPermanent: false,
        isQuotaExceeded: true,
        category: 'PROVIDER_QUOTA_EXCEEDED',
        enhancedCode: enhancedCode || '5.4.5',
        responseCode: responseCode || 550,
        reason: 'Email provider daily sending limit or quota exceeded (SMTP 550 5.4.5)',
        userMessage: 'Email delivery temporarily unavailable due to email service sending limits. Please contact system administrator.',
        adminAction: 'The SMTP provider (e.g. Gmail) daily sending quota was exhausted. Provider requires waiting for 24h rolling quota reset or configuring SMTP_FALLBACK in .env.',
      };
    }

    // 2. INVALID RECIPIENT / MAILBOX NOT FOUND
    if (
      enhancedCode === '5.1.1' ||
      enhancedCode === '5.1.2' ||
      enhancedCode === '5.1.3' ||
      combined.includes('user unknown') ||
      combined.includes('mailbox not found') ||
      combined.includes('recipient address rejected') ||
      combined.includes('does not exist') ||
      combined.includes('no such user') ||
      combined.includes('invalid recipient') ||
      combined.includes('mailbox unavailable')
    ) {
      return {
        isPermanent: true,
        isQuotaExceeded: false,
        category: 'INVALID_RECIPIENT',
        enhancedCode: enhancedCode || '5.1.1',
        responseCode: responseCode || 550,
        reason: `Recipient address rejected by mail server (${enhancedCode || '5.1.1'})`,
        userMessage: 'Registered email address was rejected by the mail server. Please contact administrator to update your email.',
        adminAction: 'Check the faculty member email in database. Ensure the mailbox is active on the institutional mail domain.',
      };
    }

    // 3. SENDER AUTHENTICATION / SPF / DKIM / DMARC / RELAY RESTRICTIONS
    if (
      enhancedCode === '5.7.1' ||
      enhancedCode === '5.7.26' ||
      enhancedCode === '5.7.0' ||
      combined.includes('relay access denied') ||
      combined.includes('relay not permitted') ||
      combined.includes('spf') ||
      combined.includes('dkim') ||
      combined.includes('dmarc') ||
      combined.includes('sender rejected') ||
      combined.includes('not authorized to send')
    ) {
      return {
        isPermanent: true,
        isQuotaExceeded: false,
        category: 'POLICY_REJECTION',
        enhancedCode: enhancedCode || '5.7.1',
        responseCode: responseCode || 550,
        reason: `Sender domain policy or SPF/DKIM/DMARC restriction (${enhancedCode || '5.7.1'})`,
        userMessage: 'Email rejected due to sender domain policy (SPF/DKIM). Please contact system administrator.',
        adminAction: 'Verify that MAIL_FROM_EMAIL matches SMTP_USER or has authorized sender permissions with SPF/DKIM in DNS.',
      };
    }

    // 4. SMTP SERVER AUTHENTICATION (BAD USER/PASS)
    if (
      code === 'EAUTH' ||
      enhancedCode === '5.7.8' ||
      enhancedCode === '5.5.1' ||
      combined.includes('authentication failed') ||
      combined.includes('bad credentials') ||
      combined.includes('invalid credentials') ||
      combined.includes('username and password not accepted')
    ) {
      return {
        isPermanent: true,
        isQuotaExceeded: false,
        category: 'AUTH_FAILURE',
        enhancedCode: enhancedCode || '5.7.8',
        responseCode: responseCode || 535,
        reason: 'SMTP Authentication failure - credentials rejected by mail server',
        userMessage: 'Email server authentication failed. Administrator must update SMTP credentials.',
        adminAction: 'Verify SMTP_USER and SMTP_PASS (App Password) in .env file.',
      };
    }

    // 5. TRANSIENT NETWORK / THROTTLING ERRORS
    if (
      (responseCode && String(responseCode).startsWith('4')) ||
      enhancedCode?.startsWith('4') ||
      combined.includes('try again later') ||
      combined.includes('service temporarily busy') ||
      ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ESOCKET'].includes(code)
    ) {
      return {
        isPermanent: false,
        isQuotaExceeded: false,
        category: 'TRANSIENT',
        enhancedCode: enhancedCode || '4.0.0',
        responseCode: responseCode || 421,
        reason: 'Transient network or provider throttling',
        userMessage: 'Temporary network delay. Delivery is being retried automatically...',
        adminAction: null,
      };
    }

    // 6. OTHER 5XX PERMANENT ERRORS
    if (responseCode && String(responseCode).startsWith('5')) {
      return {
        isPermanent: true,
        isQuotaExceeded: false,
        category: 'PERMANENT_SMTP',
        enhancedCode,
        responseCode,
        reason: `Permanent SMTP failure (${responseCode}${enhancedCode ? ` ${enhancedCode}` : ''})`,
        userMessage: `Email delivery failed (${responseCode}). Please contact system administrator.`,
        adminAction: `Review SMTP response: ${err.response || err.message}`,
      };
    }

    // 7. DEFAULT TRANSIENT
    return {
      isPermanent: false,
      isQuotaExceeded: false,
      category: 'UNKNOWN',
      enhancedCode: null,
      responseCode: null,
      reason: 'Transient connection error',
      userMessage: 'Temporary delivery issue. Retrying...',
      adminAction: null,
    };
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
   * Send an individual job through the SMTP transport, with automatic fallback transport if configured
   */
  async processJob(job) {
    if (!job || !job.to) {
      return;
    }
    const primaryTransport = this.getTransport();
    if (!primaryTransport) {
      const err = new Error('SMTP environment variables are not configured on the server.');
      const classification = this.classifyError(err);
      await this.handleJobFailure(job, err, classification);
      return;
    }

    const { fromName, fromEmail, formatted: fromFormatted } = this.getFromAddress();

    const mailOptions = {
      from: fromFormatted,
      replyTo: fromEmail,
      to: job.to,
      subject: job.subject,
      text: job.text,
      html: job.html,
      envelope: {
        from: fromEmail,
        to: job.to,
      },
      headers: {
        'X-Entity-Ref-ID': String(job._id),
      },
    };

    try {
      if (job.otpTokenId) {
        await OtpToken.updateOne(
          { _id: job.otpTokenId },
          { $set: { deliveryStatus: 'processing' } }
        ).catch(() => {});
      }

      let sentInfo;
      try {
        sentInfo = await primaryTransport.sendMail(mailOptions);
      } catch (primaryErr) {
        const primaryClassification = this.classifyError(primaryErr);
        // If primary transport fails due to quota limits, transient, or network error, attempt fallback transport
        const fallbackTransport = this.getFallbackTransport();
        if (fallbackTransport && (primaryClassification.isQuotaExceeded || !primaryClassification.isPermanent)) {
          logger.warn('Primary SMTP transport failed; attempting delivery via fallback transport...', {
            jobId: job._id,
            primaryError: primaryErr.message,
          });
          sentInfo = await fallbackTransport.sendMail(mailOptions);
          sentInfo = { ...sentInfo, viaFallback: true };
        } else {
          throw primaryErr;
        }
      }

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
            metadata: {
              ...(job.metadata || {}),
              messageId: sentInfo?.messageId,
              viaFallback: !!sentInfo?.viaFallback,
            },
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
        viaFallback: !!sentInfo?.viaFallback,
      });
    } catch (sendErr) {
      const classification = this.classifyError(sendErr);
      await this.handleJobFailure(job, sendErr, classification);
    }
  }

  /**
   * Handle job delivery failures with accurate error classification and backoff
   */
  async handleJobFailure(job, error, classification) {
    const errorMessage = error?.message || String(error);
    const hasExceededAttempts = job.attempts >= job.maxAttempts;
    const isPermanent = classification ? classification.isPermanent : false;
    const isQuotaExceeded = classification ? classification.isQuotaExceeded : false;
    const userMessage = classification?.userMessage || 'Email delivery failed. Please contact system administrator.';

    if (isPermanent || hasExceededAttempts || isQuotaExceeded) {
      // Mark failed
      await EmailJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'failed',
            isPermanentError: isPermanent,
            lastError: errorMessage,
            lockedAt: null,
            lockedBy: null,
            metadata: {
              ...(job.metadata || {}),
              category: classification?.category,
              enhancedCode: classification?.enhancedCode,
              responseCode: classification?.responseCode,
              adminAction: classification?.adminAction,
            },
          },
        }
      );

      if (job.otpTokenId) {
        await OtpToken.updateOne(
          { _id: job.otpTokenId },
          {
            $set: {
              deliveryStatus: 'failed',
              deliveryError: userMessage,
            },
          }
        ).catch(() => {});
      }

      logger.error('Email job permanently failed', {
        jobId: job._id,
        empId: job.empId,
        toMasked: this.maskEmail(job.to),
        attempts: job.attempts,
        category: classification?.category,
        enhancedCode: classification?.enhancedCode,
        responseCode: classification?.responseCode,
        reason: classification?.reason,
        adminAction: classification?.adminAction,
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
            metadata: {
              ...(job.metadata || {}),
              category: classification?.category,
              enhancedCode: classification?.enhancedCode,
              responseCode: classification?.responseCode,
            },
          },
        }
      );

      if (job.otpTokenId) {
        await OtpToken.updateOne(
          { _id: job.otpTokenId },
          {
            $set: {
              deliveryStatus: 'pending',
              deliveryError: `Retrying email delivery in ${Math.round(backoffMs / 1000)}s...`,
            },
          }
        ).catch(() => {});
      }

      logger.warn('Email job transient failure; scheduled retry', {
        jobId: job._id,
        empId: job.empId,
        toMasked: this.maskEmail(job.to),
        attempts: job.attempts,
        category: classification?.category,
        nextAttemptAt,
        delayMs: backoffMs,
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
