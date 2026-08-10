require('dotenv').config();
const { mongoose, connect } = require('./src/db');

async function fixIndexes() {
  try {
    await connect();
    const db = mongoose.connection;
    
    // Log existing indexes
    const indexes = await db.collection('workloads').indexes();
    console.log('Current Workload Indexes:');
    indexes.forEach(idx => {
      console.log(`- ${idx.name} (unique: ${idx.unique || false})`);
    });

    // Drop potentially restrictive indexes that should not be unique
    const problemIndexes = [
      'courseId_1_year_1_section_1_facultyRole_1', 
      'empId_1_courseId_1_year_1_section_1'
    ];

    for (const name of problemIndexes) {
      try {
        await db.collection('workloads').dropIndex(name);
        console.log(`Dropped problematic index: ${name}`);
      } catch (e) {
        // Ignore if not exists
      }
    }

    // Re-sync indexes from Mongoose schema to ensure correct ones are built
    await mongoose.model('Workload').syncIndexes();
    console.log('Indexes synced with Mongoose schema successfully.');
    
    // Check resulting indexes
    const newIndexes = await db.collection('workloads').indexes();
    console.log('New Workload Indexes:');
    newIndexes.forEach(idx => {
      console.log(`- ${idx.name} (unique: ${idx.unique || false})`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

fixIndexes();
