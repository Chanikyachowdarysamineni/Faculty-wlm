require('dotenv').config();
const { mongoose, connect } = require('./src/db');
require('./src/models/Course');

async function checkCourseIndexes() {
  try {
    await connect();
    const db = mongoose.connection;
    const Course = mongoose.model('Course');

    const indexes = await db.collection('courses').indexes();
    console.log('Current Course Indexes:');
    indexes.forEach(idx => {
      console.log(`- ${idx.name} (unique: ${idx.unique || false})`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

checkCourseIndexes();
