const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌  MONGO_URI is not set. Please add it to server/.env');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    const Workload = require('./src/models/Workload');

    // First remove duplicates to allow the unique index to build
    const duplicates = await Workload.aggregate([
      { $group: {
          _id: { courseId: '$courseId', year: '$year', section: '$section', facultyRole: '$facultyRole' },
          count: { $sum: 1 },
          docs: { $push: '$_id' }
      }},
      { $match: { count: { $gt: 1 } } }
    ]);

    console.log('Found duplicates:', JSON.stringify(duplicates, null, 2));

    let removedCount = 0;
    for (const dup of duplicates) {
      // Keep the first one, delete the rest
      const [, ...toDelete] = dup.docs;
      for (const id of toDelete) {
        await Workload.findByIdAndDelete(id);
        removedCount++;
      }
    }

    console.log('Removed ' + removedCount + ' duplicates.');

    // Sync the indexes
    try {
      await Workload.syncIndexes();
      console.log('Indexes synced successfully');
    } catch (err) {
      console.error('Error syncing indexes:', err);
    }

    process.exit(0);
  })
  .catch(err => {
    console.error('❌  Connection failed:', err.message);
    process.exit(1);
  });
