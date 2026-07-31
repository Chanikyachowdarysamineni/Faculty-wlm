const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Faculty = require('../src/models/Faculty');
const { recalculateCapacity } = require('../src/utils/capacityUtils');

async function migrateCapacity() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB.');

    // 1. Rename weeklyCapacityHours to capacity and totalWorkingHours to capacity (if it exists)
    const updateResult = await Faculty.collection.updateMany(
      {},
      {
        $rename: {
          'weeklyCapacityHours': 'capacity'
        }
      }
    );
    console.log(`Renamed fields in ${updateResult.modifiedCount} faculty documents.`);

    // 2. Remove capacityHours from Workload collection
    const Workload = mongoose.connection.collection('workload');
    const wlUpdateResult = await Workload.updateMany(
      {},
      {
        $unset: {
          'capacityHours': ""
        }
      }
    );
    console.log(`Removed capacityHours from ${wlUpdateResult.modifiedCount} workload documents.`);

    // 3. Trigger recalculation for all faculty to populate allocated, remaining, status, and workloadPercentage
    const faculties = await Faculty.find({});
    console.log(`Recalculating workload for ${faculties.length} faculty...`);
    
    let recalcCount = 0;
    for (const f of faculties) {
      // Ensure capacity is an integer and defaulting to 18 if missing
      if (!f.capacity || isNaN(f.capacity) || f.capacity <= 0) {
        f.capacity = 18;
      } else {
        f.capacity = Math.round(Number(f.capacity));
      }
      
      // We manually save here to ensure the capacity is correctly set before recalculateCapacity uses it
      await f.save();

      // Recalculate which will update allocated, remaining, workloadPercentage, status
      await recalculateCapacity(f.empId, { updatedBy: 'Migration_Script' });
      recalcCount++;
    }
    
    console.log(`Successfully recalculated ${recalcCount} faculty.`);
    console.log('Migration complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateCapacity();
