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
const { body, validationResult } = require('express-validator');
const User     = require('../models/User');
const Faculty  = require('../models/Faculty');
const OtpToken = require('../models/OtpToken');
const TokenBlacklist = require('../models/TokenBlacklist');
const { signToken } = require('../utils/jwt');
const { requireAuth, validateActiveSession } = require('../middleware/auth');
const getIp = (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress;
const { sendSuccess, sendError, sendUnauthorized, sendValidationError } = require('../utils/response');
const logger = require('../utils/logger');
const { validateLogin } = require('../middleware/validators');
const { loginLimiter } = require('../middleware/rateLimiters');
const { isAdminEmployeeId } = require('../config/adminConfig');

const router = express.Router();

const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES || 30);
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);

// ── Email transport (configured via env vars) ──────────────
let mailTransport = null;

const getMailTransport = () => {
  if (mailTransport) return mailTransport;
  if (!process.env.SMTP_HOST) return null;
  
  mailTransport = nodemailer.createTransport({
    pool: true,
    maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 5),
    maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 100),
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
  return mailTransport;
};

// ── OTP Email sender ──────────────────────────────────────
const sendOtpEmail = async ({ toEmail, empId, otp, expiryMinutes }) => {
  const transport = getMailTransport();
  if (!transport) {
    logger.warn('OTP email not sent — SMTP not configured');
    return;
  }

  const fromName  = process.env.MAIL_FROM_NAME || 'VFSTR Faculty System';
  const fromEmail = process.env.SMTP_USER; // Strictly use authenticated user to prevent spoofing flags

  const htmlBody = `
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

  const textBody =
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

  await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    replyTo: fromEmail,
    to: toEmail,
    subject: 'Your OTP Login Code – Faculty Workload Management System',
    text: textBody,
    html: htmlBody
  });
};



// ─────────────────────────────────────────────────────────
//  POST /api/auth/send-otp   — faculty enters employee ID → OTP is emailed
// ─────────────────────────────────────────────────────────
router.post(
  '/send-otp',
  loginLimiter,
  [body('employeeId').trim().notEmpty().withMessage('Employee ID is required.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return sendValidationError(res, errors.array());

      const empId = req.body.employeeId.trim();

      // Check user exists
      const user = await User.findOne({ empId });
      if (!user) {
        logger.warn('OTP requested for non-existent user', { empId, ip: getIp(req) });
        // Generic message to not reveal whether ID exists
        return sendSuccess(res, null, 200, { message: 'If the Employee ID is registered, an OTP has been sent to the associated email.' });
      }

      // Check if faculty is relieved
      const facultyData = await Faculty.findOne({ empId }).lean();
      if (facultyData?.relievingDate && new Date(facultyData.relievingDate) < new Date()) {
        return sendError(res, 'Account deactivated (Faculty Relieved).', 403);
      }

      // H-7: Check account lock
      if (user.lockUntil && user.lockUntil > new Date()) {
        const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
        return sendError(res, `Account is temporarily locked. Try again in ${minutesLeft} minute(s).`, 429);
      }

      // Determine email to send OTP to
      let email = user.email || facultyData?.email || '';


      if (!email) {
        logger.warn('OTP requested but no email on file', { empId });
        return sendError(res, 'No email address found for this Employee ID. Please contact the administrator.', 400);
      }

      // Generate and persist OTP
      const rawOtp = await OtpToken.createOtp(empId, OTP_EXPIRY_MINUTES);

      // Send OTP email
      try {
        await sendOtpEmail({ toEmail: email, empId, otp: rawOtp, expiryMinutes: OTP_EXPIRY_MINUTES });
        logger.info('OTP email sent', { empId, email });
      } catch (mailErr) {
        logger.error('Failed to send OTP email', { empId, error: mailErr.message });
        // Clean up the token so the user can retry
        await OtpToken.deleteMany({ empId });
        return sendError(res, 'Failed to send OTP email. Please try again or contact the administrator.', 500);
      }

      // Mask email for display (e.g., vf***@gmail.com)
      const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + b.replace(/./g, '*') + c);

      return sendSuccess(res, { maskedEmail }, 200, {
        message: `OTP sent to ${maskedEmail}. It is valid for ${OTP_EXPIRY_MINUTES} minutes.`,
      });
    } catch (err) {
      logger.error('Send OTP error', { error: err.message });
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
    body('employeeId').trim().notEmpty().withMessage('Employee ID is required.'),
    body('otp').trim().notEmpty().withMessage('OTP is required.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return sendValidationError(res, errors.array());

      const empId = req.body.employeeId.trim();
      const rawOtp = req.body.otp.trim();

      const user = await User.findOne({ empId });
      if (!user) return sendError(res, 'Employee ID not found.', 401);

      // Check lock
      if (user.lockUntil && user.lockUntil > new Date()) {
        const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
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

      // Verify OTP
      const expectedHash = OtpToken.hashOtp(rawOtp);
      if (otpDoc.otpHash !== expectedHash) {
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

      // Mark OTP as used
      await OtpToken.updateOne({ _id: otpDoc._id }, { $set: { usedAt: new Date() } });

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
    if (req.token && req.user && req.user.exp) {
      // Decode exp which is in seconds, convert to Date
      const expiresAt = new Date(req.user.exp * 1000);
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