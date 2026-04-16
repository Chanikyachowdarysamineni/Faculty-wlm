#!/usr/bin/env node
/**
 * diagnostic.js — Quick diagnostic check for WLM login issues
 *
 * Usage:
 *   node src/diagnostic.js
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { connect, mongoose } = require('./db');
const User = require('./models/User');

(async () => {
  console.log('\n🔍 WLM LOGIN DIAGNOSTIC\n');
  console.log('=' .repeat(50));
  
  try {
    // Check 1: Environment
    console.log('\n✓ Environment Check:');
    console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`  PORT: ${process.env.PORT || '5000'}`);
    console.log(`  MONGO_URI: ${process.env.MONGO_URI ? '✅ Set' : '❌ NOT SET'}`);
    console.log(`  JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Set' : '❌ NOT SET'}`);

    // Check 2: Database Connection
    console.log('\n✓ Database Connection:');
    await connect();
    console.log('  ✅ Connected to MongoDB');

    // Check 3: Check for existing users
    console.log('\n✓ User Check:');
    const userCount = await User.countDocuments();
    console.log(`  Total users in database: ${userCount}`);

    if (userCount === 0) {
      console.log('\n⚠️  NO USERS FOUND!');
      console.log('   This is why login is failing (401 Unauthorized).');
      console.log('\n   Run the seeding script:');
      console.log('   > npm run seed\n');
      await mongoose.connection.close();
      process.exit(0);
    }

    // List all users
    const users = await User.find({}, { empId: 1, name: 1, role: 1 }).lean();
    console.log('\n  Existing users:');
    users.forEach(u => {
      console.log(`    • ${u.empId} (${u.name}) - Role: ${u.role}`);
    });

    // Check 4: Test credentials
    console.log('\n✓ Default Admin Credentials:');
    const adminId = process.env.ADMIN_ID || 'admin';
    const adminUser = await User.findOne({ empId: adminId });
    
    if (adminUser) {
      console.log(`  ✅ Admin user "${adminId}" exists`);
    } else {
      console.log(`  ❌ Admin user "${adminId}" NOT found`);
      console.log(`     Expected from ADMIN_ID in .env`);
    }

    console.log('\n' + '=' .repeat(50));
    console.log('\n✅ Diagnostic complete!\n');
    
    if (userCount > 0) {
      console.log('💡 If login still fails:');
      console.log('   1. Make sure backend server is running (npm run dev)');
      console.log('   2. Verify CORS is configured correctly');
      console.log('   3. Check browser console for network errors\n');
    }

  } catch (err) {
    console.error('\n❌ Diagnostic Error:', err.message);
    console.log('\nPossible cause:');
    console.log('  • MongoDB connection failed');
    console.log('  • Invalid MONGO_URI');
    console.log('  • Network issues\n');
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
})();
