/**
 * routes/auth.js
 *
 * POST /api/auth/login           — login (fetched from users collection)
 * POST /api/auth/forgot-password — request password reset
 * POST /api/auth/reset-password  — confirm password reset
 * PUT  /api/auth/change-password — change password (requires auth)
 * GET  /api/auth/me              — current user info (requires token)
 */

'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const nodemailer = require('nodemailer');
const { body, query, validationResult } = require('express-validator');
const User     = require('../models/User');
const Faculty  = require('../models/Faculty');
const OtpToken = require('../models/OtpToken');
const TokenBlacklist = require('../models/TokenBlacklist');
const { signToken } = require('../utils/jwt');
const { requireAuth, requireAdmin, validateActiveSession } = require('../middleware/auth');
const emailQueue = require('../services/emailQueue');
const getIp = (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress;
const { sendSuccess, sendError, sendUnauthorized, sendValidationError } = require('../utils/response');
const logger = require('../utils/logger');
const { validateLogin } = require('../middleware/validators');
const { loginLimiter, otpLimiter, otpIpLimiter } = require('../middleware/rateLimiters');
const { isAdminEmployeeId } = require('../config/adminConfig');

const router = express.Router();

const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES || 30);
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);

// ── Email transport (configured via env vars with connection pool) ──────────────
let mailTransport = null;

const getMailTransport = () => {
  if (mailTransport) return mailTransport;
  if (!process.env.SMTP_HOST) return null;
  
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE !== undefined 
    ? process.env.SMTP_SECURE === 'true' 
    : port === 465;
  
  mailTransport = nodemailer.createTransport({
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 8000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false,
    },
  });

  // Pre-warm connection in background
  mailTransport.verify((err) => {
    if (err) {
      logger.warn('SMTP connection pre-warm notice', { error: err.message });
    } else {
      logger.info('SMTP connection pool initialized and verified');
    }
  });

  return mailTransport;
};

// Mask email for display (e.g. vf***@gmail.com)
const maskEmail = (email = '') => {
  if (!email || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0] || '*'}*@${domain}`;
  }
  const visiblePrefix = local.slice(0, 2);
  const maskedLocal = visiblePrefix + '*'.repeat(Math.min(6, Math.max(3, local.length - 2)));
  return `${maskedLocal}@${domain}`;
};

/**
 * Resolve User and Faculty records by either Employee ID or verified linked Email address
 */
const findUserAndFaculty = async (identifier) => {
  const trimmed = String(identifier || '').trim();
  const isEmail = trimmed.includes('@');

  if (isEmail) {
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const emailRegex = new RegExp(`^${escaped}$`, 'i');

    let user = await User.findOne({ email: emailRegex });
    let facultyData = await Faculty.findOne({ email: emailRegex }).lean();

    // Cross-reference: find matching Faculty if only User was found or vice versa
    if (user && !facultyData) {
      facultyData = await Faculty.findOne({ empId: user.empId }).lean();
    } else if (!user && facultyData) {
      user = await User.findOne({ empId: facultyData.empId });
    }

    const resolvedEmpId = user?.empId || facultyData?.empId || null;
    return { user, facultyData, isEmail: true, resolvedEmpId };
  }

  // Standard Employee ID lookup
  const [user, facultyData] = await Promise.all([
    User.findOne({ empId: trimmed }),
    Faculty.findOne({ empId: trimmed }).lean(),
  ]);

  return { user, facultyData, isEmail: false, resolvedEmpId: trimmed };
};

/**
 * Build professional responsive OTP email template
 */
const generateOtpEmailContent = (otp, expiryMinutes) => {
  const subject = 'Your OTP Login Code – Faculty Workload Management System';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #222; background: #f4f6fb; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 32px auto; background: #fff; border-radius: 10px; box-shadow: 0 2px 12px rgba(80,80,120,0.10); overflow: hidden; }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 28px 32px 18px; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header p  { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px; }
    .body { padding: 28px 32px; }
    .otp-block { background: #f0f4ff; border: 2px dashed #6366f1; border-radius: 10px; text-align: center; padding: 24px 16px; margin: 24px 0; }
    .otp-block .otp { font-size: 42px; font-weight: 900; letter-spacing: 12px; color: #4f46e5; font-family: monospace; }
    .otp-block .label { font-size: 13px; color: #6b7280; margin-top: 8px; }
    .info { font-size: 14px; color: #374151; line-height: 1.7; }
    .warn { background: #fff7ed; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 10px 14px; margin: 18px 0; font-size: 13px; color: #92400e; }
    .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 18px 32px; font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.6; }
    .footer strong { color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Faculty Workload Management System</h1>
      <p>Department of Computer Science &amp; Engineering &mdash; VFSTR</p>
    </div>
    <div class="body">
      <p class="info">Dear Faculty Member,</p>
      <p class="info">
        Your One-Time Password (OTP) for logging in to the
        <strong>Faculty Workload Management System &ndash; Department of Computer Science &amp; Engineering</strong> is:
      </p>
      <div class="otp-block">
        <div class="otp">${otp}</div>
        <div class="label">One-Time Password</div>
      </div>
      <p class="info">
        This OTP is valid for <strong>${expiryMinutes} minutes</strong> and can be used only once.
      </p>
      <div class="warn">
        ⚠️ For your security, please do not share this OTP with anyone.
      </div>
      <p class="info">
        If you did not request this OTP, please ignore this email. Your account remains secure.
      </p>
    </div>
    <div class="footer">
      <strong>Faculty Workload Management System</strong><br>
      Department of Computer Science &amp; Engineering<br>
      Vignan&rsquo;s Foundation for Science, Technology &amp; Research (VFSTR)<br><br>
      <em>This is an automated email. Please do not reply to this message.</em><br><br>
      Regards,<br>
      Department of Computer Science &amp; Engineering, VFSTR.
    </div>
  </div>
</body>
</html>
`;

  const text =
`Dear Faculty Member,

Your One-Time Password (OTP) for logging in to the Faculty Workload Management System – Department of Computer Science & Engineering is:

  ${otp}

This OTP is valid for ${expiryMinutes} minutes and can be used only once.

For your security, please do not share this OTP with anyone.

If you did not request this OTP, please ignore this email. Your account remains secure.

Faculty Workload Management System
Department of Computer Science & Engineering
Vignan's Foundation for Science, Technology & Research (VFSTR)

This is an automated email. Please do not reply to this message.

Regards,
Department of Computer Science & Engineering
VFSTR.`;

  return { subject, html, text };
};

// ─────────────────────────────────────────────────────────
//  POST /api/auth/send-otp   — faculty enters empId OR linked email → OTP queued
// ─────────────────────────────────────────────────────────
router.post(
  '/send-otp',
  otpIpLimiter,
  otpLimiter,
  [
    body('employeeId')
      .trim()
      .notEmpty()
      .withMessage('Employee ID or linked email is required.')
      .isLength({ min: 1, max: 100 })
      .withMessage('Invalid identifier format.')
      .matches(/^[a-zA-Z0-9_\-\.@+]+$/)
      .withMessage('Identifier contains invalid characters.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return sendValidationError(res, errors.array());

      const rawIdentifier = req.body.employeeId.trim();
      const { user, facultyData, isEmail } = await findUserAndFaculty(rawIdentifier);

      if (!user) {
        logger.warn('OTP requested for non-existent user', { identifier: rawIdentifier, ip: getIp(req) });
        return sendError(
          res,
          isEmail
            ? 'Email address is not linked to any registered account. Please contact the administrator.'
            : 'Employee ID is not registered. Please contact the administrator.',
          404
        );
      }

      const empId = user.empId;

      // Check if faculty is relieved or deleted
      if (user.isDeleted || facultyData?.isDeleted) {
        return sendError(res, 'Account deactivated.', 403);
      }
      const relDateVal = user.relievingDate || facultyData?.relievingDate;
      if (relDateVal) {
        const relievingDate = new Date(relDateVal);
        relievingDate.setHours(23, 59, 59, 999);
        if (new Date() > relievingDate) {
          return sendError(res, 'Account deactivated (Faculty Relieved).', 403);
        }
      }

      // Check account lock
      if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
        const minutesLeft = Math.ceil((new Date(user.lockUntil) - Date.now()) / 60000);
        return sendError(res, `Account is temporarily locked. Try again in ${minutesLeft} minute(s).`, 429);
      }

      // Determine destination email
      const email = user.email || facultyData?.email || (isEmail ? rawIdentifier : '');
      if (!email) {
        logger.warn('OTP requested but no email on file', { empId });
        return sendError(res, 'No verified email address found for this account. Please contact the administrator.', 400);
      }

      // Enforce 60-second server-side resend cooldown per canonical employee ID
      const recentOtp = await OtpToken.getRecentActiveOtp(empId, 60);
      if (recentOtp) {
        const elapsedSeconds = Math.floor((Date.now() - new Date(recentOtp.createdAt).getTime()) / 1000);
        const waitSeconds = Math.max(1, 60 - elapsedSeconds);
        return sendError(res, `Please wait ${waitSeconds}s before requesting a new OTP.`, 429);
      }

      // Generate cryptographically secure OTP and save to DB
      const { raw: rawOtp, docId } = await OtpToken.createOtp(empId, OTP_EXPIRY_MINUTES);

      // Mask email for display
      const maskedEmail = maskEmail(email);

      // Generate email content
      const { subject, html, text } = generateOtpEmailContent(rawOtp, OTP_EXPIRY_MINUTES);

      // Enqueue into durable email queue (handles provider rate limits, retries, worker pooling)
      await emailQueue.enqueueEmail({
        type: 'otp',
        empId,
        to: email,
        subject,
        text,
        html,
        otpTokenId: docId,
        metadata: { clientIp: getIp(req) },
      });

      // Respond instantly (< 30ms) to frontend
      return sendSuccess(
        res,
        {
          empId,
          maskedEmail,
          expiryMinutes: OTP_EXPIRY_MINUTES,
          cooldownSeconds: 60,
        },
        200,
        {
          message: `OTP sent to ${maskedEmail}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
        }
      );
    } catch (err) {
      logger.error('Send OTP error', { error: err.message });
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────
//  GET /api/auth/otp-status  — check delivery status of latest OTP
// ─────────────────────────────────────────────────────────
router.get(
  '/otp-status',
  [
    query('employeeId')
      .trim()
      .notEmpty()
      .withMessage('Employee ID is required.')
      .matches(/^[a-zA-Z0-9_\-\.@+]+$/)
      .withMessage('Invalid format.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return sendValidationError(res, errors.array());

      const rawIdentifier = req.query.employeeId.trim();
      const { user, resolvedEmpId } = await findUserAndFaculty(rawIdentifier);
      const empId = user?.empId || resolvedEmpId || rawIdentifier;

      const latestOtp = await OtpToken.findOne({ empId }).sort({ createdAt: -1 }).lean();

      if (!latestOtp) {
        return sendError(res, 'No OTP request found.', 404);
      }

      return sendSuccess(res, {
        deliveryStatus: latestOtp.deliveryStatus || 'pending',
        deliveryError: latestOtp.deliveryError || null,
        deliveredAt: latestOtp.deliveredAt || null,
        isExpired: new Date() > new Date(latestOtp.expiresAt),
        isUsed: !!latestOtp.usedAt,
      });
    } catch (err) {
      logger.error('OTP status error', { error: err.message });
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────
//  POST /api/auth/verify-otp  — faculty submits OTP → JWT issued
// ─────────────────────────────────────────────────────────
router.post(
  '/verify-otp',
  loginLimiter,
  [
    body('employeeId')
      .trim()
      .notEmpty()
      .withMessage('Employee ID or linked email is required.')
      .matches(/^[a-zA-Z0-9_\-\.@+]+$/)
      .withMessage('Invalid format.'),
    body('otp')
      .trim()
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('OTP must be a 6-digit number.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return sendValidationError(res, errors.array());

      const rawIdentifier = req.body.employeeId.trim();
      const rawOtp = req.body.otp.trim();

      const { user, facultyData, isEmail } = await findUserAndFaculty(rawIdentifier);

      if (!user) {
        return sendError(res, isEmail ? 'Linked email not found.' : 'Employee ID not found.', 401);
      }

      const empId = user.empId;

      if (user.isDeleted || facultyData?.isDeleted) {
        return sendError(res, 'Account deactivated.', 403);
      }
      const relDateVal = user.relievingDate || facultyData?.relievingDate;
      if (relDateVal) {
        const relievingDate = new Date(relDateVal);
        relievingDate.setHours(23, 59, 59, 999);
        if (new Date() > relievingDate) {
          return sendError(res, 'Account deactivated (Faculty Relieved).', 403);
        }
      }

      // Check lock
      if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
        const minutesLeft = Math.ceil((new Date(user.lockUntil) - Date.now()) / 60000);
        return sendError(res, `Account is temporarily locked. Try again in ${minutesLeft} minute(s).`, 429);
      }

      // Find a valid OTP doc
      const otpDoc = await OtpToken.findOne({
        empId,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      });

      if (!otpDoc) {
        return sendError(res, 'OTP has expired or was not found. Please request a new OTP.', 400);
      }

      // Verify OTP using constant-time comparison (prevents timing attacks)
      const expectedHash = OtpToken.hashOtp(rawOtp);
      const expectedBuffer = Buffer.from(expectedHash, 'utf8');
      const storedBuffer = Buffer.from(otpDoc.otpHash || '', 'utf8');
      const isMatch = expectedBuffer.length === storedBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, storedBuffer);

      if (!isMatch) {
        // Increment attempt counter; lock after 5 bad guesses
        const newAttempts = (otpDoc.attempts || 0) + 1;
        if (newAttempts >= 5) {
          await OtpToken.deleteMany({ empId });
          await User.updateOne({ _id: user._id }, { $set: { lockUntil: new Date(Date.now() + 15 * 60 * 1000) } });
          return sendError(res, 'Too many wrong OTP attempts. Account locked for 15 minutes.', 429);
        }
        await OtpToken.updateOne({ _id: otpDoc._id }, { $set: { attempts: newAttempts } });
        return sendError(res, `Invalid OTP. ${5 - newAttempts} attempt(s) remaining.`, 401);
      }

      // Single-use token: immediately delete OTP tokens for this user to prevent replay
      await OtpToken.deleteMany({ empId });

      // Reset failed login attempts on success
      if (user.failedLoginAttempts || user.lockUntil) {
        await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockUntil: null } });
      }

      const isAdminUser = isAdminEmployeeId(user.empId);
      const userRole = isAdminUser ? 'admin' : user.role;

      const payload = {
        id:             user.empId,
        empId:          user.empId,
        role:           userRole,
        name:           user.name,
        canAccessAdmin: user.canAccessAdmin || isAdminUser,
        forcePasswordChange: false, // OTP login bypasses forced password change
        tokenVersion:   user.tokenVersion || 0,
      };
      const token = signToken(payload);

      await User.updateOne(
        { _id: user._id },
        { $set: { lastLoginIp: getIp(req), lastLoginAt: new Date() } }
      );

      logger.info('OTP login successful', { empId: user.empId, role: userRole, ip: getIp(req) });
      return sendSuccess(res, { token, user: payload }, 200, { message: 'Login successful' });
    } catch (err) {
      logger.error('Verify OTP error', { error: err.message });
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────
//  GET /api/auth/email-queue/status  — queue monitoring (admin only)
// ─────────────────────────────────────────────────────────
router.get('/email-queue/status', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const stats = await emailQueue.getQueueStats();
    return sendSuccess(res, stats);
  } catch (err) {
    logger.error('Email queue status error', { error: err.message });
    next(err);
  }
});



// ─────────────────────────────────────────────────────────
//  GET /api/auth/me
// ─────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { id, role, name, canAccessAdmin } = req.user;
    let extra = {};
    const user = await User.findOne({ empId: id }).lean();
    if (user) extra = { designation: user.designation, mobile: user.mobile, email: user.email };
    logger.debug('User profile retrieved', { empId: id });
    sendSuccess(res, { user: { id, role, name, canAccessAdmin, ...extra } });
  } catch (err) {
    logger.error('Auth me endpoint error', { error: err.message });
    next(err);
  }
});

// ─────────────────────────────────────────────────────────
//  POST /api/auth/logout  (requires auth)
// ─────────────────────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 'User not authenticated.', 401);
    }

    // Log the logout event and blacklist the token
    if (req.token) {
      const expiresAt = req.user?.exp ? new Date(req.user.exp * 1000) : new Date(Date.now() + 8 * 3600000);
      try {
        await TokenBlacklist.create({ token: req.token, expiresAt });
      } catch (e) {
        // Ignore duplicate key errors if already blacklisted
        if (e.code !== 11000) throw e;
      }
    }

    logger.info('User logged out successfully', { empId: req.user.id });
    return sendSuccess(res, null, 200, { message: 'Logged out successfully.' });
  } catch (err) {
    logger.error('Logout error', { error: err.message });
    next(err);
  }
});

module.exports = router;