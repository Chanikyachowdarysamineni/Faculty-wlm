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
const PasswordResetToken = require('../models/PasswordResetToken');
const TokenBlacklist = require('../models/TokenBlacklist');
const { signToken } = require('../utils/jwt');
const { requireAuth, requireAdmin, validateActiveSession } = require('../middleware/auth');
const emailQueue = require('../services/emailQueue');
const getIp = (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress;
const { sendSuccess, sendError, sendUnauthorized, sendValidationError } = require('../utils/response');
const logger = require('../utils/logger');
const { validateLogin, validateChangePassword, validatePasswordReset } = require('../middleware/validators');
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
  if (!trimmed) return { user: null, facultyData: null, isEmail: false, resolvedEmpId: null };

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

  // Support system admin lookup using 'admin' or configured ADMIN_ID
  const adminIds = ['admin'];
  if (process.env.ADMIN_ID) adminIds.push(process.env.ADMIN_ID.trim());

  let user = null;
  let facultyData = null;

  if (adminIds.map(id => id.toLowerCase()).includes(trimmed.toLowerCase())) {
    user = await User.findOne({ empId: { $in: adminIds } });
    facultyData = await Faculty.findOne({ empId: { $in: adminIds } }).lean();
  } else {
    [user, facultyData] = await Promise.all([
      User.findOne({ empId: trimmed }),
      Faculty.findOne({ empId: trimmed }).lean(),
    ]);
  }

  // Cross-reference if needed
  if (user && !facultyData) {
    facultyData = await Faculty.findOne({ empId: user.empId }).lean();
  } else if (!user && facultyData) {
    user = await User.findOne({ empId: facultyData.empId });
  }

  const resolvedEmpId = user?.empId || facultyData?.empId || trimmed;
  return { user, facultyData, isEmail: false, resolvedEmpId };
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

/**
 * Format timestamp in IST human-readable format
 */
const formatDateTimeIST = (date = new Date()) => {
  try {
    const d = new Date(date);
    return d.toLocaleString('en-IN', {
      dateStyle: 'full',
      timeStyle: 'medium',
      timeZone: 'Asia/Kolkata',
    }) + ' IST';
  } catch {
    return new Date(date).toUTCString();
  }
};

/**
 * Build professional responsive Password Reset email template
 */
const generatePasswordResetEmailContent = ({ empId, rawToken, resetCode, expiryMinutes, appUrl }) => {
  const subject = 'Password Reset Request – Department of Computer Science & Engineering (VFSTR)';
  const resetLink = `${appUrl}/reset-password?token=${encodeURIComponent(rawToken)}&empId=${encodeURIComponent(empId)}`;

  const text =
`Dear Faculty Member,

A password reset request was received for your account (${empId}) in the Faculty Workload Management System – Department of Computer Science & Engineering (VFSTR).

To reset your password, you can either:

1. Enter this 6-digit verification code on the website:
   ${resetCode}

OR

2. Use the secure reset link below:
   ${resetLink}

This code and link are valid for ${expiryMinutes} minutes and can be used only once.

If you did not request a password reset, please ignore this email or notify the administrator immediately.

Best regards,

Department of Computer Science and Engineering (CSE)
Vignan's Foundation for Science, Technology and Research (VFSTR)
Vadlamudi, Guntur - 522213
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1f2937; background: #f1f5f9; margin: 0; padding: 0; }
    .container { max-width: 540px; margin: 32px auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 28px 32px 20px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; line-height: 1.3; }
    .header p { margin: 6px 0 0; font-size: 13.5px; opacity: 0.92; }
    .body { padding: 30px 32px; font-size: 14.5px; line-height: 1.7; color: #334155; }
    .code-box { background: #f0fdf4; border: 2px dashed #16a34a; border-radius: 10px; text-align: center; padding: 20px 16px; margin: 22px 0; }
    .code-val { font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #15803d; font-family: monospace; }
    .code-sub { font-size: 12.5px; color: #4b5563; margin-top: 6px; }
    .btn-wrap { text-align: center; margin: 26px 0 18px; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; }
    .btn:hover { background: #1d4ed8; }
    .warn { background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #92400e; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; font-size: 12.5px; color: #64748b; line-height: 1.6; }
    .footer strong { color: #1e293b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Department of Computer Science &amp; Engineering</h1>
      <p>Faculty Workload Management &mdash; VFSTR</p>
    </div>
    <div class="body">
      <p style="margin-top: 0;"><strong>Dear Faculty Member,</strong></p>
      <p>A password reset request was received for account <strong>${empId}</strong>. You can reset your password using the 6-digit verification code below or by clicking the direct reset button.</p>

      <div class="code-box">
        <div class="code-val">${resetCode}</div>
        <div class="code-sub">Password Reset Verification Code (Valid for ${expiryMinutes} minutes)</div>
      </div>

      <div class="btn-wrap">
        <a href="${resetLink}" class="btn" target="_blank" rel="noopener noreferrer">Reset Password Online</a>
      </div>

      <div class="warn">
        &bull; This verification code and link will expire in <strong>${expiryMinutes} minutes</strong>.<br>
        &bull; For your account security, never share this code or reset link with anyone.
      </div>

      <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
        If you did not request this password reset, please ignore this email. Your current password will remain unchanged.
      </p>
    </div>
    <div class="footer">
      <strong>Faculty Workload Management System</strong><br>
      Department of Computer Science &amp; Engineering<br>
      Vignan&rsquo;s Foundation for Science, Technology &amp; Research (VFSTR)<br>
      <em>Vadlamudi, Guntur, Andhra Pradesh &mdash; 522213</em>
    </div>
  </div>
</body>
</html>
`;

  return { subject, html, text };
};

/**
 * Build exact required Password Change Confirmation email template (Requirement 3)
 */
const generatePasswordChangeEmailContent = ({ empId, changedAt }) => {
  const formattedDateTime = formatDateTimeIST(changedAt);
  const subject = 'Your Password Has Been Changed Successfully – Department of CSE';

  const text =
`Dear Faculty Member,

Greetings from Vignan’s Foundation for Science, Technology and Research (VFSTR), Department of Computer Science and Engineering (CSE).

This email is to inform you that your account password has been successfully changed.

- Account: ${empId}
- Date & Time: ${formattedDateTime}

Important: Please take a screenshot of your new password for future logins and store it securely.

If you did not make this change, please contact the administrator immediately to secure your account.

Best regards,

Department of Computer Science and Engineering (CSE)
Vignan’s Foundation for Science, Technology and Research (VFSTR)

Regards from the CSE Developers Batch 2023–2027`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1f2937; background: #f1f5f9; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px 32px 22px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 21px; font-weight: 700; letter-spacing: 0.3px; line-height: 1.3; }
    .header p { margin: 6px 0 0; font-size: 13.5px; opacity: 0.92; }
    .body { padding: 32px; font-size: 14.5px; line-height: 1.7; color: #334155; }
    .greeting { font-size: 15px; font-weight: 600; color: #0f172a; margin-top: 0; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 20px 0; }
    .info-row { display: flex; margin-bottom: 8px; font-size: 14px; }
    .info-row:last-child { margin-bottom: 0; }
    .info-label { font-weight: 600; color: #475569; width: 110px; flex-shrink: 0; }
    .info-val { color: #0f172a; font-weight: 500; }
    .alert-box { background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 14px 18px; margin: 22px 0; color: #92400e; font-size: 13.5px; line-height: 1.55; }
    .security-notice { background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px 18px; margin: 20px 0; color: #991b1b; font-size: 13.5px; line-height: 1.55; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 32px; font-size: 13px; color: #64748b; line-height: 1.6; }
    .footer strong { color: #1e293b; }
    .dev-credit { margin-top: 12px; font-style: italic; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Department of Computer Science &amp; Engineering</h1>
      <p>Vignan&rsquo;s Foundation for Science, Technology and Research (VFSTR)</p>
    </div>
    <div class="body">
      <p class="greeting">Dear Faculty Member,</p>
      <p>Greetings from <strong>Vignan&rsquo;s Foundation for Science, Technology and Research (VFSTR), Department of Computer Science and Engineering (CSE).</strong></p>
      <p>This email is to inform you that your account password has been successfully changed.</p>
      
      <div class="info-card">
        <div class="info-row">
          <span class="info-label">&bull; Account:</span>
          <span class="info-val">${empId}</span>
        </div>
        <div class="info-row">
          <span class="info-label">&bull; Date &amp; Time:</span>
          <span class="info-val">${formattedDateTime}</span>
        </div>
      </div>

      <div class="alert-box">
        <strong>Important:</strong> Please take a screenshot of your new password for future logins and store it securely.
      </div>

      <div class="security-notice">
        If you did not make this change, please contact the administrator immediately to secure your account.
      </div>

      <p style="margin-top: 24px; margin-bottom: 0;">
        Best regards,<br><br>
        <strong>Department of Computer Science and Engineering (CSE)</strong><br>
        Vignan&rsquo;s Foundation for Science, Technology and Research (VFSTR)
      </p>
    </div>
    <div class="footer">
      <strong>VFSTR &mdash; Faculty Work Load Management</strong><br>
      Vadlamudi, Guntur, Andhra Pradesh &mdash; 522213<br>
      <div class="dev-credit">Regards from the CSE Developers Batch 2023&ndash;2027</div>
    </div>
  </div>
</body>
</html>
`;

  return { subject, html, text };
};

/**
 * Dispatch password change confirmation email reliably via durable queue
 */
const sendPasswordChangeNotification = async ({ empId, email, changedAt }) => {
  if (!email || !email.includes('@')) {
    logger.warn('Skipping password change notification: no valid email address', { empId });
    return;
  }

  const { subject, html, text } = generatePasswordChangeEmailContent({ empId, changedAt });
  await emailQueue.enqueueEmail({
    type: 'notification',
    empId,
    to: email,
    subject,
    text,
    html,
    metadata: {
      category: 'PASSWORD_CHANGED',
      empId,
      changedAt: changedAt.toISOString(),
    },
  });
  logger.info('Password change confirmation notification enqueued', { empId, toMasked: maskEmail(email) });
};

// ─────────────────────────────────────────────────────────
//  POST /api/auth/login  — password login (using registered mobile number as default password)
// ─────────────────────────────────────────────────────────
router.post(
  '/login',
  loginLimiter,
  validateLogin,
  async (req, res, next) => {
    try {
      const rawIdentifier = String(req.body.employeeId || '').trim();
      const rawPassword = String(req.body.password || '');

      let { user, facultyData, isEmail } = await findUserAndFaculty(rawIdentifier);

      // Auto-provision User account if faculty exists in Faculty list but lacks User record
      if (!user && facultyData) {
        const defaultPassword = String(facultyData.mobile || facultyData.empId || '').trim();
        const initialHash = await bcrypt.hash(defaultPassword, 10);
        const isAdmin = isAdminEmployeeId(facultyData.empId);
        user = await User.create({
          empId: facultyData.empId,
          name: facultyData.name,
          designation: facultyData.designation,
          mobile: facultyData.mobile || '',
          email: facultyData.email || '',
          passwordHash: initialHash,
          role: isAdmin ? 'admin' : 'faculty',
          canAccessAdmin: isAdmin,
          forcePasswordChange: true,
          joiningDate: facultyData.joiningDate || null,
          relievingDate: facultyData.relievingDate || null,
        });
        logger.info('Auto-provisioned User account during password login', { empId: facultyData.empId });
      }

      if (!user) {
        logger.warn('Password login attempted for non-existent account', { identifier: rawIdentifier, ip: getIp(req) });
        return sendError(res, isEmail ? 'Registered email address not found.' : 'Employee ID not found.', 401);
      }

      const empId = user.empId;

      // Check if faculty is deleted or relieved
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

      // ── Password Verification ──
      // 1. Compare against user.passwordHash
      let isMatch = false;
      if (user.passwordHash) {
        isMatch = bcrypt.compareSync(rawPassword, user.passwordHash);
      }

      // 2. Dynamic mobile number fallback & auto-sync:
      // If user.passwordHash did not match, check if entered password matches the registered
      // mobile number dynamically fetched from the database (Faculty List).
      // Only permitted if the user has not yet changed their default password to a custom password.
      const hasCustomPassword = Boolean(user.passwordChangedAt || user.forcePasswordChange === false);
      const registeredMobile = String(facultyData?.mobile || user.mobile || '').trim();
      if (!isMatch && !hasCustomPassword && registeredMobile && rawPassword.trim() === registeredMobile) {
        const newHash = await bcrypt.hash(registeredMobile, 10);
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              passwordHash: newHash,
              mobile: registeredMobile,
            }
          }
        );
        user.passwordHash = newHash;
        isMatch = true;
        logger.info('Dynamically synchronized passwordHash from registered mobile number', { empId });
      }

      if (!isMatch) {
        const newAttempts = (user.failedLoginAttempts || 0) + 1;
        if (newAttempts >= 5) {
          await User.updateOne(
            { _id: user._id },
            {
              $set: {
                failedLoginAttempts: newAttempts,
                lockUntil: new Date(Date.now() + 15 * 60 * 1000)
              }
            }
          );
          logger.warn('Account locked due to consecutive failed password attempts', { empId, ip: getIp(req) });
          return sendError(res, 'Too many failed login attempts. Account locked for 15 minutes.', 429);
        }

        await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: newAttempts } });
        logger.warn('Failed login attempt', { empId, attempts: newAttempts, ip: getIp(req) });
        return sendError(res, `Invalid password. ${5 - newAttempts} attempt(s) remaining.`, 401);
      }

      // Reset failed login attempts on success
      if (user.failedLoginAttempts || user.lockUntil) {
        await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockUntil: null } });
      }

      const isAdminUser = isAdminEmployeeId(user.empId) || Boolean(user.canAccessAdmin) || String(user.role).toLowerCase() === 'admin';
      const userRole = isAdminUser ? 'admin' : (user.role || 'faculty');

      const payload = {
        id:             user.empId,
        empId:          user.empId,
        role:           userRole,
        name:           user.name,
        canAccessAdmin: Boolean(user.canAccessAdmin || isAdminUser),
        forcePasswordChange: Boolean(user.forcePasswordChange),
        tokenVersion:   user.tokenVersion || 0,
      };
      const token = signToken(payload);

      await User.updateOne(
        { _id: user._id },
        { $set: { lastLoginIp: getIp(req), lastLoginAt: new Date() } }
      );

      logger.info('Password login successful', { empId: user.empId, role: userRole, ip: getIp(req) });
      return sendSuccess(res, { token, user: payload }, 200, { message: 'Login successful' });
    } catch (err) {
      logger.error('Login error', { error: err.message });
      next(err);
    }
  }
);

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

      // Pre-validate deliverability & block placeholder domains (.local, .test, etc.)
      const trimmedEmail = email.trim().toLowerCase();
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
      const emailDomain = trimmedEmail.split('@')[1] || '';
      const isPlaceholder = ['wlm.local', 'localhost', 'example.com', 'test.com'].includes(emailDomain) ||
        emailDomain.endsWith('.local') || emailDomain.endsWith('.test') || emailDomain.endsWith('.invalid');

      if (!emailRegex.test(trimmedEmail) || isPlaceholder) {
        logger.warn('OTP requested for unrouteable or placeholder email', { empId, email: trimmedEmail });
        return sendError(
          res,
          `The registered email address for this account (${maskEmail(trimmedEmail)}) is not a valid deliverable mailbox. Please contact the administrator to update your official email address.`,
          400
        );
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

      // Find the most recent active OTP doc
      const otpDoc = await OtpToken.findOne({
        empId,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      }).sort({ createdAt: -1 });

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
          await OtpToken.updateMany({ empId, usedAt: null }, { $set: { usedAt: new Date() } });
          await User.updateOne({ _id: user._id }, { $set: { lockUntil: new Date(Date.now() + 15 * 60 * 1000) } });
          return sendError(res, 'Too many wrong OTP attempts. Account locked for 15 minutes.', 429);
        }
        await OtpToken.updateOne({ _id: otpDoc._id }, { $set: { attempts: newAttempts } });
        return sendError(res, `Invalid OTP. ${5 - newAttempts} attempt(s) remaining.`, 401);
      }

      // Single-use token: invalidate OTP tokens for this user to prevent replay
      await OtpToken.updateMany({ empId, usedAt: null }, { $set: { usedAt: new Date() } });

      // Reset failed login attempts on success
      if (user.failedLoginAttempts || user.lockUntil) {
        await User.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockUntil: null } });
      }

      const isAdminUser = isAdminEmployeeId(user.empId) || Boolean(user.canAccessAdmin) || String(user.role).toLowerCase() === 'admin';
      const userRole = isAdminUser ? 'admin' : (user.role || 'faculty');

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
//  POST /api/auth/forgot-password  — request password reset
// ─────────────────────────────────────────────────────────
router.post(
  '/forgot-password',
  otpIpLimiter,
  otpLimiter,
  [
    body('employeeId')
      .trim()
      .notEmpty()
      .withMessage('Employee ID or registered email is required.')
      .matches(/^[a-zA-Z0-9_\-\.@+]+$/)
      .withMessage('Invalid identifier format.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return sendValidationError(res, errors.array());

      const rawIdentifier = req.body.employeeId.trim();
      const { user, facultyData, isEmail, resolvedEmpId } = await findUserAndFaculty(rawIdentifier);

      // Account enumeration protection:
      // Return safe generic message if no account matches
      if (!user && !facultyData) {
        logger.warn('Password reset requested for non-existent account', { identifier: rawIdentifier, ip: getIp(req) });
        return sendSuccess(res, {
          maskedEmail: 'your registered email',
          expiryMinutes: 15,
        }, 200, {
          message: 'If an account is associated with this identifier, a password reset code and link have been sent to your registered email.'
        });
      }

      const empId = user?.empId || facultyData?.empId || resolvedEmpId;

      // Check if account is relieved or deactivated
      if (user?.isDeleted || facultyData?.isDeleted) {
        return sendError(res, 'Account deactivated.', 403);
      }
      const relDateVal = user?.relievingDate || facultyData?.relievingDate;
      if (relDateVal) {
        const relievingDate = new Date(relDateVal);
        relievingDate.setHours(23, 59, 59, 999);
        if (new Date() > relievingDate) {
          return sendError(res, 'Account deactivated (Faculty Relieved).', 403);
        }
      }

      const email = user?.email || facultyData?.email || (isEmail ? rawIdentifier : '');
      if (!email) {
        logger.warn('Password reset requested but no verified email on file', { empId });
        return sendError(res, 'No verified email address found for this account. Please contact the administrator.', 400);
      }

      // Generate reset token and 6-digit verification code
      const { rawToken, resetCode, expiresAt } = await PasswordResetToken.createReset(empId, 15, getIp(req));

      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      const appUrl = `${protocol}://${host}/csefaculty`;

      const { subject, html, text } = generatePasswordResetEmailContent({
        empId,
        rawToken,
        resetCode,
        expiryMinutes: 15,
        appUrl,
      });

      // Enqueue password reset email
      await emailQueue.enqueueEmail({
        type: 'password_reset',
        empId,
        to: email,
        subject,
        text,
        html,
        metadata: {
          category: 'PASSWORD_RESET',
          empId,
        },
      });

      logger.info('Password reset instructions enqueued successfully', { empId, toMasked: maskEmail(email), ip: getIp(req) });
      return sendSuccess(res, {
        empId,
        maskedEmail: maskEmail(email),
        expiryMinutes: 15,
      }, 200, {
        message: 'Password reset code and link have been sent to your registered email.'
      });
    } catch (err) {
      logger.error('Forgot password error', { error: err.message });
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────
//  POST /api/auth/reset-password  — confirm password reset with token or 6-digit code
// ─────────────────────────────────────────────────────────
router.post(
  '/reset-password',
  loginLimiter,
  validatePasswordReset,
  async (req, res, next) => {
    try {
      const { token, code, employeeId, newPassword } = req.body;

      // Verify token or code atomically
      let verifiedDoc;
      try {
        verifiedDoc = await PasswordResetToken.verifyAndUseTokenOrCode({
          token: token ? String(token).trim() : null,
          code: code ? String(code).trim() : null,
          empId: employeeId ? String(employeeId).trim() : null,
        });
      } catch (tokenErr) {
        return sendError(res, tokenErr.message, 400);
      }

      const empId = verifiedDoc.empId;
      let { user, facultyData } = await findUserAndFaculty(empId);

      // Auto-provision User account if faculty member is in Faculty list but lacks User doc
      if (!user && facultyData) {
        const isAdmin = isAdminEmployeeId(facultyData.empId);
        user = await User.create({
          empId: facultyData.empId,
          name: facultyData.name,
          designation: facultyData.designation,
          mobile: facultyData.mobile || '',
          email: facultyData.email || '',
          passwordHash: 'temporary',
          role: isAdmin ? 'admin' : 'faculty',
          canAccessAdmin: isAdmin,
          forcePasswordChange: false,
          joiningDate: facultyData.joiningDate || null,
          relievingDate: facultyData.relievingDate || null,
        });
        logger.info('Auto-provisioned User during password reset', { empId });
      }

      if (!user) {
        return sendError(res, 'User account not found.', 404);
      }

      const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      const nextTokenVersion = (user.tokenVersion || 0) + 1;
      const changedAt = new Date();

      // Commit password update to database
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordHash,
            forcePasswordChange: false,
            failedLoginAttempts: 0,
            lockUntil: null,
            tokenVersion: nextTokenVersion,
            passwordChangedAt: changedAt,
          }
        }
      );

      // Invalidate all pending reset tokens for this user
      await PasswordResetToken.updateMany(
        { empId, usedAt: null },
        { $set: { usedAt: new Date() } }
      );

      // Automatically send confirmation email notification after database commit
      const email = user.email || facultyData?.email || '';
      if (email) {
        sendPasswordChangeNotification({
          empId: user.empId,
          email,
          changedAt,
        }).catch((notifyErr) => {
          logger.warn('Password change notification email error', { empId, error: notifyErr.message });
        });
      }

      logger.info('Password reset completed successfully', { empId, ip: getIp(req) });
      return sendSuccess(res, {
        account: user.empId,
        empId: user.empId,
        changedAt: changedAt.toISOString(),
      }, 200, {
        message: 'Password has been reset successfully. You may now log in with your new password.'
      });
    } catch (err) {
      logger.error('Reset password error', { error: err.message });
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────
//  PUT /api/auth/change-password  (requires auth)
// ─────────────────────────────────────────────────────────
router.put(
  '/change-password',
  requireAuth,
  validateChangePassword,
  async (req, res, next) => {
    try {
      const empId = req.user.id || req.user.empId;
      const { user, facultyData } = await findUserAndFaculty(empId);
      if (!user) {
        return sendError(res, 'User not found.', 404);
      }

      // Check current password against passwordHash or dynamic mobile number
      let isMatch = false;
      if (user.passwordHash) {
        isMatch = bcrypt.compareSync(req.body.currentPassword, user.passwordHash);
      }
      if (!isMatch && (facultyData?.mobile || user?.mobile)) {
        const mob = (facultyData?.mobile || user?.mobile || '').trim();
        isMatch = req.body.currentPassword.trim() === mob;
      }

      if (!isMatch) {
        return sendError(res, 'Current password is incorrect.', 401);
      }

      const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
      const passwordHash = await bcrypt.hash(req.body.newPassword, BCRYPT_ROUNDS);
      const nextTokenVersion = (user.tokenVersion || 0) + 1;
      const changedAt = new Date();

      // Commit update to database
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordHash,
            forcePasswordChange: false,
            failedLoginAttempts: 0,
            lockUntil: null,
            tokenVersion: nextTokenVersion,
            passwordChangedAt: changedAt,
          }
        }
      );

      // Invalidate active reset tokens
      await PasswordResetToken.updateMany(
        { empId: user.empId, usedAt: null },
        { $set: { usedAt: new Date() } }
      );

      // Automatically dispatch email notification after successful database commit (Requirement 3)
      const email = user.email || facultyData?.email || '';
      if (email) {
        try {
          await sendPasswordChangeNotification({
            empId: user.empId,
            email,
            changedAt,
          });
        } catch (notifyErr) {
          logger.warn('Password change notification email error', { empId: user.empId, error: notifyErr.message });
        }
      }

      const isAdminUser = isAdminEmployeeId(user.empId) || Boolean(user.canAccessAdmin) || String(user.role).toLowerCase() === 'admin';
      const userRole = isAdminUser ? 'admin' : (user.role || 'faculty');
      const updatedUserPayload = {
        id: user.empId,
        empId: user.empId,
        role: userRole,
        name: user.name,
        canAccessAdmin: Boolean(user.canAccessAdmin || isAdminUser),
        forcePasswordChange: false,
        tokenVersion: nextTokenVersion,
      };
      const newToken = signToken(updatedUserPayload);

      logger.info('Password changed successfully', { empId: user.empId });
      return sendSuccess(res, {
        token: newToken,
        user: updatedUserPayload,
        account: user.empId,
        changedAt: changedAt.toISOString(),
      }, 200, {
        message: 'Password changed successfully.'
      });
    } catch (err) {
      logger.error('Change password error', { error: err.message });
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