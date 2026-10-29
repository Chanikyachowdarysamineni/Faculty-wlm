'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Faculty = require('../models/Faculty');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const requireAcademicPeriod = require('../middleware/academicPeriod');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const { ADMIN_EMPLOYEE_IDS, isAdminEmployeeId } = require('../config/adminConfig');
const { buildFacultyDateFilter } = require('../utils/academicPeriodUtils');
const wsHandler = require('../websocket');

const router = express.Router();

// GET /api/admin-management/users - List active faculty matching FacultyPage with admin status
router.get('/users', requireAuth, requireAdmin, requireAcademicPeriod, async (req, res, next) => {
  try {
    const periodStart = req.academicPeriod?.periodStart || req.academicPeriod?.academicYear?.startDate;
    const periodEnd = req.academicPeriod?.periodEnd || req.academicPeriod?.academicYear?.endDate;

    // 1. Authoritative active faculty filter identical to FacultyPage
    const baseFilter = {
      isDeleted: { $ne: true },
      empId: { $nin: ADMIN_EMPLOYEE_IDS }
    };

    // Apply joining and relieving date eligibility rules
    const dateClauses = buildFacultyDateFilter(periodStart, periodEnd);
    if (dateClauses.length > 0) {
      baseFilter.$and = dateClauses;
    }

    // 2. Fetch distinct active faculty matching FacultyPage
    const facultyDocs = await Faculty.find(
      baseFilter,
      'slNo empId name designation department email joiningDate relievingDate updatedAt'
    ).sort({ slNo: 1, empId: 1 }).lean();

    // Deduplicate by empId to guarantee every faculty member appears exactly once
    const facultyMap = new Map();
    for (const f of facultyDocs) {
      const empIdKey = String(f.empId || '').trim();
      if (!empIdKey) continue;
      if (!facultyMap.has(empIdKey)) {
        facultyMap.set(empIdKey, f);
      } else {
        const existing = facultyMap.get(empIdKey);
        if (f.updatedAt && (!existing.updatedAt || new Date(f.updatedAt) > new Date(existing.updatedAt))) {
          facultyMap.set(empIdKey, f);
        }
      }
    }
    const facultyList = Array.from(facultyMap.values());

    // 3. Fetch corresponding User accounts to get roles and admin access
    const empIds = facultyList.map(f => f.empId);
    const users = await User.find(
      { empId: { $in: empIds } },
      'empId role canAccessAdmin'
    ).lean();

    const userMap = new Map();
    users.forEach(u => userMap.set(String(u.empId).trim(), u));

    // 4. Merge faculty details with effective admin status
    const usersWithAdminStatus = facultyList.map((faculty, idx) => {
      const empIdStr = String(faculty.empId).trim();
      const u = userMap.get(empIdStr);
      const isEnvAdmin = isAdminEmployeeId(empIdStr);
      const isDbAdmin = u?.role === 'admin' || u?.role === 'Admin' || !!u?.canAccessAdmin;
      return {
        _id: faculty._id,
        slNo: faculty.slNo || idx + 1,
        empId: empIdStr,
        name: faculty.name,
        designation: faculty.designation || 'N/A',
        department: faculty.department || 'CSE',
        email: faculty.email || '',
        joiningDate: faculty.joiningDate ? new Date(faculty.joiningDate).toISOString() : null,
        relievingDate: faculty.relievingDate ? new Date(faculty.relievingDate).toISOString() : null,
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
    if (!makeAdmin && (empId === req.user.empId || empId === req.user.id)) {
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
      const defaultPassword = String(faculty.mobile || faculty.empId || '').trim();
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      user = await User.create({
        empId: faculty.empId,
        name: faculty.name,
        email: faculty.email || `${faculty.empId}@vignan.ac.in`,
        mobile: faculty.mobile || '',
        designation: faculty.designation,
        passwordHash,
        role: roleToSet,
        canAccessAdmin: Boolean(makeAdmin),
        forcePasswordChange: true,
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

    wsHandler.broadcast({ type: 'admin_management_updated', empId, makeAdmin });
    wsHandler.broadcast({ type: 'user_updated', empId });

    sendSuccess(res, { message: `User ${empId} is ${makeAdmin ? 'now' : 'no longer'} an admin` }, 200);
  } catch (err) {
    logger.error('Error toggling admin status', { error: err.message });
    next(err);
  }
});

module.exports = router;
