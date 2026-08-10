require('dotenv').config();
const { mongoose, connect } = require('./src/db');
require('./src/models/Workload'); // Register the schema!

async function fixIndexes() {
  try {
    await connect();
    const db = mongoose.connection;
    const Workload = mongoose.model('Workload');

    console.log('Dropping uniq_ta_per_course_section_year just to be safe...');
    try {
      await db.collection('workloads').dropIndex('uniq_ta_per_course_section_year');
      console.log('Dropped uniq_ta_per_course_section_year');
    } catch(e) {
      console.log('Not found or could not drop:', e.message);
    }

    try {
      await db.collection('workloads').dropIndex('courseId_1_year_1_section_1_facultyRole_1');
    } catch(e) {}

    console.log('Syncing indexes...');
    await Workload.syncIndexes();
    console.log('Indexes synced successfully!');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

fixIndexes();
