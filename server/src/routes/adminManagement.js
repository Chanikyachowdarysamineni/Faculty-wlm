'use strict';

const express = require('express');
const User = require('../models/User');
const Faculty = require('../models/Faculty');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const { ADMIN_EMPLOYEE_IDS, isAdminEmployeeId } = require('../config/adminConfig');

const router = express.Router();

// GET /api/admin-management/users - List active faculty matching FacultyPage with admin status
router.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    // 1. Fetch active faculty matching FacultyPage exactly (excluding deleted & system admin IDs)
    const facultyList = await Faculty.find(
      { isDeleted: { $ne: true }, empId: { $nin: ADMIN_EMPLOYEE_IDS } },
      'slNo empId name designation department email'
    ).sort({ slNo: 1 }).lean();

    // 2. Fetch corresponding User accounts to get roles and admin access
    const empIds = facultyList.map(f => f.empId);
    const users = await User.find(
      { empId: { $in: empIds } },
      'empId role canAccessAdmin'
    ).lean();

    const userMap = new Map();
    users.forEach(u => userMap.set(String(u.empId).trim(), u));

    // 3. Merge faculty details with effective admin status
    const usersWithAdminStatus = facultyList.map(faculty => {
      const u = userMap.get(String(faculty.empId).trim());
      const isEnvAdmin = isAdminEmployeeId(faculty.empId);
      const isDbAdmin = u?.role === 'admin' || u?.role === 'Admin' || !!u?.canAccessAdmin;
      return {
        _id: faculty._id,
        slNo: faculty.slNo || 0,
        empId: faculty.empId,
        name: faculty.name,
        designation: faculty.designation || 'N/A',
        department: faculty.department || 'CSE',
        email: faculty.email || '',
        role: u?.role || 'faculty',
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

    const roleToSet = makeAdmin ? 'admin' : 'faculty';
    let user = await User.findOne({ empId });
    if (!user) {
      const faculty = await Faculty.findOne({ empId });
      if (!faculty) return sendError(res, 'Faculty member not found', 404);
      user = await User.create({
        empId: faculty.empId,
        name: faculty.name,
        email: faculty.email || `${faculty.empId}@vignan.ac.in`,
        designation: faculty.designation,
        role: roleToSet,
        canAccessAdmin: Boolean(makeAdmin),
      });
    } else {
      await User.updateOne(
        { empId },
        {
          $set: { role: roleToSet, canAccessAdmin: Boolean(makeAdmin) },
          $inc: { tokenVersion: 1 }
        }
      );
    }

    sendSuccess(res, { message: `User ${empId} is ${makeAdmin ? 'now' : 'no longer'} an admin` }, 200);
  } catch (err) {
    logger.error('Error toggling admin status', { error: err.message });
    next(err);
  }
});

module.exports = router;
