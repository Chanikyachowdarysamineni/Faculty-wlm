'use strict';

const express = require('express');
const User = require('../models/User');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const { isAdminEmployeeId } = require('../config/adminConfig');

const router = express.Router();

// GET /api/admin-management/users - List all users with admin status
router.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const users = await User.find({}, 'empId name designation role canAccessAdmin').lean();
    
    const usersWithAdminStatus = users.map(user => {
      // Env var admins are strictly enforced, but we return the effective status
      const isEnvAdmin = isAdminEmployeeId(user.empId);
      const isDbAdmin = user.role === 'admin' || user.role === 'Admin' || user.canAccessAdmin;
      return {
        ...user,
        isEnvAdmin,
        isEffectiveAdmin: isEnvAdmin || isDbAdmin,
      };
    });

    sendSuccess(res, usersWithAdminStatus, 200);
  } catch (err) {
    logger.error('Error fetching users for admin management', { error: err.message });
    next(err);
  }
});

// POST /api/admin-management/toggle-admin - Toggle admin status for a user
router.post('/toggle-admin', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { empId, makeAdmin } = req.body;
    
    if (!empId) return sendError(res, 'Employee ID is required', 400);
    
    // Prevent removing self or system admin
    if (!makeAdmin && empId === req.user.empId) {
      return sendError(res, 'You cannot remove your own admin privileges', 400);
    }
    
    if (!makeAdmin && isAdminEmployeeId(empId)) {
      return sendError(res, 'Cannot remove admin privileges from a system-configured admin (configured in .env)', 400);
    }

    const user = await User.findOne({ empId });
    if (!user) return sendError(res, 'User not found', 404);

    const roleToSet = makeAdmin ? 'admin' : 'faculty';
    await User.updateOne(
      { empId },
      { $set: { role: roleToSet, canAccessAdmin: makeAdmin } }
    );

    sendSuccess(res, { message: `User ${empId} is ${makeAdmin ? 'now' : 'no longer'} an admin` }, 200);
  } catch (err) {
    logger.error('Error toggling admin status', { error: err.message });
    next(err);
  }
});

module.exports = router;
