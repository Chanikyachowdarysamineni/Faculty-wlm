/**
 * create-user.js - Script to create a new faculty user
 * Usage: node create-user.js <empId> <name> <password> <designation> <department> [email] [mobile]
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const User = require('../models/User');
const Faculty = require('../models/Faculty');
const { connect, disconnect } = require('../db');

const createUser = async (empId, name, password, designation, department, email = '', mobile = '') => {
  try {
    console.log('\n📝 Creating faculty user...');
    console.log(`   Employee ID: ${empId}`);
    console.log(`   Name: ${name}`);
    console.log(`   Designation: ${designation}`);
    console.log(`   Department: ${department}`);

    // Connect to database
    await connect();
    console.log('✅ Connected to database\n');

    // Check if user already exists
    const existingUser = await User.findOne({ empId });
    if (existingUser) {
      console.log(`❌ Error: User with Employee ID '${empId}' already exists!`);
      process.exit(1);
    }

    // Hash password using bcrypt (10 rounds like in auth.js)
    const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
    const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

    // Create User record
    const user = await User.create({
      empId,
      name,
      designation,
      email,
      mobile,
      passwordHash,
      role: 'faculty',
      canAccessAdmin: false,
    });

    console.log('✅ User created in database:');
    console.log(`   - empId: ${user.empId}`);
    console.log(`   - name: ${user.name}`);
    console.log(`   - role: ${user.role}`);
    console.log(`   - email: ${user.email || '(not set)'}`);
    console.log(`   - mobile: ${user.mobile || '(not set)'}`);

    // Create Faculty record
    const faculty = await Faculty.create({
      empId,
      name,
      designation,
      department,
      email,
      mobile,
    });

    console.log('\n✅ Faculty record created:');
    console.log(`   - empId: ${faculty.empId}`);
    console.log(`   - name: ${faculty.name}`);
    console.log(`   - designation: ${faculty.designation}`);
    console.log(`   - department: ${faculty.department}`);
    console.log(`   - totalWorkingHours: ${faculty.totalWorkingHours} (default)`);

    console.log('\n🎉 Faculty user created successfully!\n');
    console.log('Login credentials:');
    console.log(`   Employee ID: ${empId}`);
    console.log(`   Password: ${password}`);
    console.log('\nThe user can now access the faculty dashboard.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating user:', error.message);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      console.error(`   Duplicate value for field '${field}'`);
    }
    process.exit(1);
  } finally {
    await disconnect();
  }
};

// Get arguments from command line
const args = process.argv.slice(2);

if (args.length < 5) {
  console.log('\nUsage: node create-user.js <empId> <name> <password> <designation> <department> [email] [mobile]\n');
  console.log('Example:');
  console.log('  node create-user.js 100 "CSE dept" 9959949222 professor cse\n');
  process.exit(1);
}

const [empId, name, password, designation, department, email, mobile] = args;

// Validate inputs
if (password.length < 8 && password !== 'faculty123' && password !== 'admin123') {
  console.log('\n⚠️  Warning: Password is shorter than recommended (8+ characters)\n');
}

createUser(empId, name, password, designation, department, email || '', mobile || '');
