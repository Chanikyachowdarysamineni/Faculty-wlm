/**
 * migrateSemester.js
 * 
 * One-time migration: Set semester = 'ODD' on all existing records
 * that do not yet have a semester field.
 * 
 * Run with: node src/scripts/migrateSemester.js
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function migrate() {
  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected.');

  const db = mongoose.connection.db;

  const collections = [
    { name: 'courses',          field: 'semester' },
    { name: 'workloads',        field: 'semester' },
    { name: 'courseallocations',field: 'semester' },
    { name: 'submissions',      field: 'semester' },
  ];

  for (const { name, field } of collections) {
    const coll = db.collection(name);
    const result = await coll.updateMany(
      { [field]: { $exists: false } },
      { $set: { [field]: 'ODD' } }
    );
    console.log(`  📦 ${name}: ${result.modifiedCount} records updated`);
  }

  // Also create ODD FacultyCapacity records from existing Faculty capacity values
  const facultyCapacitiesColl = db.collection('faculty_capacities');
  const facultyColl = db.collection('faculties');
  const faculties = await facultyColl.find({ isDeleted: { $ne: true } }).toArray();

  let capCreated = 0;
  for (const faculty of faculties) {
    const existing = await facultyCapacitiesColl.findOne({ empId: faculty.empId, semester: 'ODD' });
    if (!existing) {
      await facultyCapacitiesColl.insertOne({
        empId: faculty.empId,
        semester: 'ODD',
        capacity: faculty.capacity || 18,
        assignedHours: 0,
        remainingHours: faculty.capacity || 18,
        percentage: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      capCreated++;
    }
  }
  console.log(`  📦 faculty_capacities: ${capCreated} ODD records created`);

  await mongoose.disconnect();
  console.log('✅ Migration complete!');
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
