/**
 * scripts/setup-admin-user.js
 * 
 * Set up or reset default admin user credentials from environment variables.
 * Usage: node scripts/setup-admin-user.js
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { connect } = require('../src/db');
const User = require('../src/models/User');
const Faculty = require('../src/models/Faculty');

async function setupAdmin() {
  try {
    await connect();
    const adminId = (process.env.ADMIN_ID || 'admin').trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin@123';

    console.log(`Setting up admin user: ${adminId}`);

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await User.findOneAndUpdate(
      { empId: adminId },
      {
        $set: {
          empId: adminId,
          name: 'System Admin',
          designation: 'Administrator',
          mobile: '0000000000',
          email: 'admin@wlm.local',
          passwordHash,
          role: 'Admin',
          canAccessAdmin: true,
          forcePasswordChange: false,
          failedLoginAttempts: 0,
          lockUntil: null,
        },
      },
      { upsert: true, new: true }
    );

    await Faculty.findOneAndUpdate(
      { empId: adminId },
      {
        $setOnInsert: {
          slNo: 0,
          empId: adminId,
          name: 'System Admin',
          designation: 'Administrator',
          department: 'CSE',
          mobile: '0000000000',
          email: 'admin@wlm.local',
          capacity: 18,
        },
      },
      { upsert: true }
    );

    console.log(`✅ Admin user "${adminId}" set up successfully.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to set up admin user:', err);
    process.exit(1);
  }
}

setupAdmin();
