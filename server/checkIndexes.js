require('dotenv').config();
const { mongoose } = require('./src/db');

async function getIndexes() {
  try {
    const db = mongoose.connection;
    const indexes = await db.collection('workloads').indexes();
    console.log(JSON.stringify(indexes, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

mongoose.connection.once('open', getIndexes);
