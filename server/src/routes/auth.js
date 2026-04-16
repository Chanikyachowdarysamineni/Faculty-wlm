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
const PasswordResetToken = require('../models/PasswordResetToken');
const { signToken } = require('../utils/jwt');
const { requireAuth, validateActiveSession } = require('../middleware/auth');
const { logAuditEvent, getIp } = require('../utils/audit');
const { sendSuccess, sendError, sendUnauthorized, sendValidationError } = require('../utils/response');
const logger = require('../utils/logger');
const { validateLogin, validatePasswordReset, validateChangePassword } = require('../middleware/validators');
const { loginLimiter, passwordResetLimiter } = require('../middleware/rateLimiters');
const { isAdminEmployeeId } = require('../config/adminConfig');

const router = express.Router();

const RESET_TOKEN_TTL_MINUTES = Number(process.env.RESET_TOKEN_TTL_MINUTES || 30);

// ── Email transport (configured via env vars) ──────────────
const createMailTransport = () => {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendResetEmail = async ({ toEmail, empId, resetToken }) => {
  const transport = createMailTransport();
  if (!transport) return; // email not configured — skip silently in dev

  const appUrl = process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',')[0].trim()
    : 'http://localhost:3000';
  const resetLink = `${appUrl}/reset-password?token=${resetToken}`;

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: 'WLM — Password Reset Request',
    text: `Hello ${empId},\n\nA password reset was requested for your account.\n\nUse this link to set a new password (valid for ${RESET_TOKEN_TTL_MINUTES} minutes):\n${resetLink}\n\nIf you did not request this, please ignore this email.\n`,
    html: `<p>Hello <strong>${empId}</strong>,</p><p>A password reset was requested for your account.</p><p><a href="${resetLink}">Reset my password</a> (valid for ${RESET_TOKEN_TTL_MINUTES} minutes)</p><p>If you did not request this, please ignore this email.</p>`,
  });
};

// ─────────────────────────────────────────────────────────
//  POST /api/auth/login
// ─────────────────────────────────────────────────────────
router.post(
  '/login',
  loginLimiter,
  validateLogin,
  async (req, res, next) => {
    try {
      const { employeeId, password } = req.body;
      const id = employeeId.trim();

      // Look up user exclusively from the users collection
      const user = await User.findOne({ empId: id });
      if (!user) {
        logger.warn('Login attempted for non-existent user', { empId: id, ip: getIp(req) });
        await logAuditEvent({ req, action: 'auth.login.failed', entity: 'user', entityId: id, metadata: { reason: 'user-not-found' } });
        return sendError(res, 'Employee ID not found.', 401);
      }

      const ok = bcrypt.compareSync(password, user.passwordHash);
      if (!ok) {
        const failedAttempts = Number(user.failedLoginAttempts || 0) + 1;
        await User.updateOne(
          { _id: user._id },
          {
            $inc: { failedLoginAttempts: 1 },
          }
        );
        logger.info('Failed login attempt', { empId: user.empId, attempt: failedAttempts, locked: false });
        await logAuditEvent({
          req,
          action: 'auth.login.failed',
          entity: 'user',
          entityId: user.empId,
          metadata: {
            reason: 'invalid-password',
            failedAttempts,
          },
        });
        return sendError(res, 'Invalid password.', 401);
      }

      if (user.failedLoginAttempts || user.lockUntil) {
        await User.updateOne(
          { _id: user._id },
          { $set: { failedLoginAttempts: 0, lockUntil: null } }
        );
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // Security: Check if this employee ID should have admin access
      // Admin roles are assigned server-side only, not from database or frontend
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const isAdminUser = isAdminEmployeeId(user.empId);
      const userRole = isAdminUser ? 'admin' : user.role;

      const payload = {
        id:             user.empId,
        role:           userRole,
        name:           user.name,
        canAccessAdmin: user.canAccessAdmin || isAdminUser,
      };
      const token = signToken(payload);

      // Track login info for audit/security logs (no session token storage needed)
      // Multiple concurrent sessions per user are allowed
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            lastLoginIp: getIp(req),
            lastLoginAt: new Date(),
          },
        }
      );

      logger.info('User logged in successfully', { empId: user.empId, role: userRole, isAdmin: isAdminUser, ip: getIp(req) });
      await logAuditEvent({ req, action: 'auth.login.success', entity: 'user', entityId: user.empId, metadata: { ip: getIp(req), role: userRole, isAdmin: isAdminUser } });
      return sendSuccess(res, { token, user: payload }, 200, { message: 'Login successful' });
    } catch (err) {
      logger.error('Login error', { error: err.message });
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────
//  POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────
router.post(
  '/forgot-password',
  passwordResetLimiter,
  [body('employeeId').trim().notEmpty().withMessage('Employee ID is required.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return sendValidationError(res, errors.array());
      }

      const empId = req.body.employeeId.trim();
      const user = await User.findOne({ empId });
      if (!user) {
        logger.info('Password reset requested for non-existent user', { empId });
        await logAuditEvent({ req, action: 'auth.reset.request.unknown', entity: 'user', entityId: empId });
        return sendSuccess(res, null, 200, { message: 'If an account exists, a reset link has been sent.' });
      }

      // Use the new createReset method from the model
      const rawToken = await PasswordResetToken.createReset(user.empId, RESET_TOKEN_TTL_MINUTES);
      
      logger.info('Password reset requested', { empId: user.empId });
      await logAuditEvent({ req, action: 'auth.reset.requested', entity: 'user', entityId: user.empId });

      // Send email if the user has one on file
      if (user.email) {
        try {
          await sendResetEmail({ toEmail: user.email, empId: user.empId, resetToken: rawToken });
          logger.info('Password reset email sent', { empId: user.empId, email: user.email });
        } catch (mailErr) {
          logger.error('Failed to send reset email', { empId: user.empId, error: mailErr.message });
        }
      }

      const response = { message: 'If an account exists, a reset link has been sent.' };
      if (process.env.NODE_ENV !== 'production') {
        response.resetToken = rawToken;
      }
      return sendSuccess(res, null, 200, response);
    } catch (err) {
      logger.error('Forgot password error', { error: err.message });
      next(err);
    }
  }
);

router.post(
  '/reset-password',
  passwordResetLimiter,
  validatePasswordReset,
  async (req, res, next) => {
    try {
      // Hash the submitted token and look it up
      const tokenHash = PasswordResetToken.hashToken(req.body.token.trim());
      const resetDoc = await PasswordResetToken.findOne({ 
        tokenHash, 
        usedAt: null, 
        expiresAt: { $gt: new Date() } 
      });
      
      if (!resetDoc) {
        logger.warn('Password reset attempt with invalid token', { ip: getIp(req) });
        return sendError(res, 'Invalid or expired reset token.', 400);
      }

      const user = await User.findOne({ empId: resetDoc.empId });
      if (!user) {
        logger.error('User not found for reset token', { empId: resetDoc.empId });
        return sendError(res, 'User not found for reset token.', 404);
      }

      // Verify and mark token as used
      await resetDoc.verifyAndUse();

      // Update user password and clear locked status
      const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
      const passwordHash = bcrypt.hashSync(req.body.newPassword, BCRYPT_ROUNDS);
      await User.updateOne(
        { _id: user._id },
        { $set: { passwordHash, failedLoginAttempts: 0, lockUntil: null } }
      );

      logger.info('Password reset completed successfully', { empId: user.empId });
      await logAuditEvent({ req, action: 'auth.reset.completed', entity: 'user', entityId: user.empId });
      return sendSuccess(res, null, 200, { message: 'Password has been reset successfully.' });
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
      const user = await User.findOne({ empId: req.user.id });
      if (!user) {
        logger.error('User not found in change-password', { empId: req.user.id });
        return sendError(res, 'User not found.', 404);
      }

      const ok = bcrypt.compareSync(req.body.currentPassword, user.passwordHash);
      if (!ok) {
        logger.warn('Change password attempt with wrong current password', { empId: req.user.id });
        return sendError(res, 'Current password is incorrect.', 401);
      }

      const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
      const passwordHash = bcrypt.hashSync(req.body.newPassword, BCRYPT_ROUNDS);
      await User.updateOne({ _id: user._id }, { $set: { passwordHash, failedLoginAttempts: 0, lockUntil: null } });
      logger.info('Password changed successfully', { empId: user.empId });
      await logAuditEvent({ req, action: 'auth.password.changed', entity: 'user', entityId: user.empId });
      return sendSuccess(res, null, 200, { message: 'Password changed successfully.' });
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

    // Log the logout event (no session token clearing needed for multi-session support)
    logger.info('User logged out successfully', { empId: req.user.id });
    await logAuditEvent({ req, action: 'auth.logout', entity: 'user', entityId: req.user.id });
    return sendSuccess(res, null, 200, { message: 'Logged out successfully.' });
  } catch (err) {
    logger.error('Logout error', { error: err.message });
    next(err);
  }
});

module.exports = router;