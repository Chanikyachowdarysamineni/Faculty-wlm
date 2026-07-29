'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Faculty = require('../models/Faculty');
const User = require('../models/User');
const Role = require('../models/Role');
const Designation = require('../models/Designation');
const logger = require('./logger');
const { isAdminEmployeeId } = require('../config/adminConfig');
const { recalculateCapacity } = require('./capacityUtils');

/**
 * Ensures dynamic roles and designations exist, then scans and repairs missing or corrupted Faculty Auth records.
 */
const syncAuthAndRBAC = async () => {
  try {
    logger.info('Starting Auth, Role, and Designation Sync...');

    // 1. Initialize default System Roles if they don't exist
    const defaultRoles = [
      { name: 'Admin', isSystem: true, permissions: ['*'] },
      { name: 'Dean', isSystem: true, permissions: ['view_all', 'edit_capacity'] },
      { name: 'HOD', isSystem: true, permissions: ['view_dept', 'edit_dept'] },
      { name: 'Placement Officer', isSystem: true, permissions: ['view_all'] },
      { name: 'Faculty', isSystem: true, permissions: ['view_own', 'edit_own_profile'] },
    ];
    for (const roleDef of defaultRoles) {
      await Role.findOneAndUpdate(
        { name: roleDef.name },
        { $setOnInsert: roleDef },
        { upsert: true }
      );
    }

    // 2. Initialize default Designations if they don't exist
    const defaultDesignations = [
      'Professor & Dean, SOCI',
      'Professor & HOD',
      'Associate Professor',
      'Assistant Professor',
      'Assistant Professor (Contract)',
      'CAP',
      'Teaching Associate',
      'Teaching Instructor',
      'Teaching Assistant',
    ];
    for (let i = 0; i < defaultDesignations.length; i++) {
      await Designation.findOneAndUpdate(
        { name: defaultDesignations[i] },
        { $setOnInsert: { name: defaultDesignations[i], order: i } },
        { upsert: true }
      );
    }

    // 3. Scan all Faculty and ensure they have an associated User record for authentication
    const allFaculty = await Faculty.find({}).lean();
    let repairedCount = 0;
    
    for (const faculty of allFaculty) {
      if (!faculty.empId) continue;
      
      const user = await User.findOne({ empId: faculty.empId });
      
      const defaultPassword = faculty.mobile ? String(faculty.mobile).trim() : String(faculty.empId).trim();
      const passwordHash = bcrypt.hashSync(defaultPassword, 10);
      
      if (!user) {
        // Missing Auth record (e.g. for 03259, 01905, 02209)
        const isAdmin = isAdminEmployeeId(faculty.empId);
        await User.create({
          empId: faculty.empId,
          name: faculty.name,
          designation: faculty.designation,
          mobile: faculty.mobile,
          email: faculty.email,
          passwordHash: passwordHash,
          role: isAdmin ? 'Admin' : 'Faculty',
          canAccessAdmin: isAdmin,
          forcePasswordChange: true
        });
        logger.info(`Repaired missing Auth record for ${faculty.empId}`);
        repairedCount++;
      } else {
        // Verify consistency (ensure no null password hashes)
        let needsUpdate = false;
        let updatePayload = {};

        if (!user.passwordHash || user.passwordHash === null) {
          updatePayload.passwordHash = passwordHash;
          updatePayload.forcePasswordChange = true;
          needsUpdate = true;
          logger.warn(`Repaired null password hash for ${faculty.empId}`);
        }
        
        // Sync role if missing
        if (!user.role || (user.role === 'admin' || user.role === 'faculty')) {
            const isAdmin = isAdminEmployeeId(faculty.empId) || user.canAccessAdmin;
            updatePayload.role = isAdmin ? 'Admin' : 'Faculty';
            needsUpdate = true;
        }

        if (needsUpdate) {
          await User.updateOne({ empId: faculty.empId }, { $set: updatePayload });
          repairedCount++;
        }
      }
      
      // Retroactively fix Workload data on boot
      try {
        await recalculateCapacity(faculty.empId, { updatedBy: 'System' });
      } catch (err) {
        logger.error(`Failed to retroactively calculate capacity for ${faculty.empId}`, err);
      }
    }
    
    logger.info(`Auth Sync completed. Total records repaired: ${repairedCount}`);
  } catch (err) {
    logger.error('Error during Auth and RBAC Sync:', err);
  }
};

module.exports = { syncAuthAndRBAC };
