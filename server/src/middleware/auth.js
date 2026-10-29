/**
 * middleware/auth.js — JWT authentication & role guards
 */

'use strict';

const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');

/**
 * Require a valid Bearer token.
 * Attaches `req.user = { id, role, name? }` on success.
 */
const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required.' });
  }

  try {
    req.user = verifyToken(token);
    req.token = token; // Store token for session validation

    // Check if the token is blacklisted
    const blacklisted = await TokenBlacklist.findOne({ token });
    if (blacklisted) {
      return res.status(401).json({ success: false, message: 'Session expired (logged out).' });
    }

    const Faculty = require('../models/Faculty');
    const [user, facultyDoc] = await Promise.all([
      User.findOne({ empId: req.user.id }).select('role canAccessAdmin tokenVersion relievingDate isDeleted').lean(),
      Faculty.findOne({ empId: req.user.id }).select('relievingDate isDeleted').lean()
    ]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }
    
    if (user.isDeleted || facultyDoc?.isDeleted) {
      return res.status(403).json({ success: false, message: 'Account deactivated.' });
    }

    const relDateVal = user.relievingDate || facultyDoc?.relievingDate;
    if (relDateVal) {
      const relievingDate = new Date(relDateVal);
      relievingDate.setHours(23, 59, 59, 999);
      if (new Date() > relievingDate) {
        return res.status(403).json({ success: false, message: 'Account deactivated: relieving date has passed.' });
      }
    }
    const tokenVer = req.user.tokenVersion || 0;
    if (tokenVer < (user.tokenVersion || 0)) {
      return res.status(401).json({ success: false, message: 'Session expired due to password change.' });
    }

    // Dynamic role & admin access synchronization from DB and bootstrap config
    const { isBootstrapAdmin } = require('../config/adminConfig');
    const isBootstrap = isBootstrapAdmin(req.user.id);
    req.user.role = isBootstrap ? 'admin' : (user.role || req.user.role || 'faculty');
    req.user.canAccessAdmin = isBootstrap || Boolean(user.canAccessAdmin || String(user.role).toLowerCase() === 'admin');

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

/**
 * Validate that the user exists (optional check for multi-session support).
 * Kept for backward compatibility, but TokenBlacklist is now checked in requireAuth.
 */
const validateActiveSession = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'User not authenticated.' });
    }

    const user = await User.findOne({ empId: req.user.id });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Session validation error.' });
  }
};

/**
 * Require the authenticated user to have the 'admin' role OR canAccessAdmin flag.
 * Must be used after requireAuth.
 * Accepts both 'admin' (JWT payload) and 'Admin' (legacy DB value) case variants.
 */
const requireAdmin = (req, res, next) => {
  const { role, canAccessAdmin } = req.user || {};
  const normalizedRole = String(role || '').toLowerCase();
  if (normalizedRole === 'admin' || canAccessAdmin === true) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Admin access required.' });
};

/**
 * Require the authenticated user to be either an admin (or canAccessAdmin) OR the same faculty
 * member referenced by `req.params.empId`.
 */
const requireSelfOrAdmin = (req, res, next) => {
  const { role, id, canAccessAdmin } = req.user || {};
  const normalizedRole = String(role || '').toLowerCase();
  if (normalizedRole === 'admin' || canAccessAdmin === true || id === req.params.empId) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access denied.' });
};

module.exports = { requireAuth, validateActiveSession, requireAdmin, requireSelfOrAdmin };
