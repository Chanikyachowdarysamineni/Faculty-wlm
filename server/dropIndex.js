require('dotenv').config();
const { mongoose } = require('./src/db');

async function dropIndex() {
  try {
    const db = mongoose.connection;
    await db.collection('courses').dropIndex('uniq_course_code_type_year');
    console.log('Successfully dropped index.');
  } catch (err) {
    console.error('Index not dropped or missing:', err.message);
  } finally {
    process.exit(0);
  }
}

mongoose.connection.once('open', dropIndex);
