require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { connect } = require('../db');
const Faculty = require('../models/Faculty');
const { recalculateCapacity } = require('../utils/capacityUtils');

async function migrate() {
  try {
    await connect();
    console.log('Connected to DB. Starting capacity migration...');

    // Find all faculty where capacity is missing
    const facultyList = await Faculty.find({});
    console.log(`Found ${facultyList.length} total faculty records.`);

    let updatedCount = 0;

    for (const fac of facultyList) {
      let needsUpdate = false;
      if (fac.capacity === undefined || fac.capacity === null) {
        fac.capacity = 18;
        needsUpdate = true;
      }
      
      // Always recalculate to ensure allocated/remaining/status are 100% accurate
      await recalculateCapacity(fac.empId);
      
      if (needsUpdate) {
        await fac.save();
        updatedCount++;
        console.log(`Updated capacity to 18 for: ${fac.empId}`);
      }
    }

    console.log(`Migration completed successfully. Updated ${updatedCount} records.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
