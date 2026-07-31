require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { connect } = require('../db');
const Faculty = require('../models/Faculty');
const { recalculateCapacity } = require('../utils/capacityUtils');

async function resetCapacity() {
  await connect();
  const facultyList = await Faculty.find({});
  console.log(`Found ${facultyList.length} faculty records.`);
  let resetCount = 0;

  for (const fac of facultyList) {
    if (fac.capacity !== 18) {
      const old = fac.capacity;
      fac.capacity = 18;
      fac.updatedBy = 'System-Reset';
      await fac.save();
      resetCount++;
      console.log(`Reset empId=${fac.empId} capacity: ${old} -> 18`);
    }
    // Recalculate for ALL to sync allocated/remaining/status
    await recalculateCapacity(fac.empId, { updatedBy: 'System-Reset' });
  }

  console.log(`\n✅ Done. Reset ${resetCount} records to capacity=18. Recalculated all ${facultyList.length}.`);
  process.exit(0);
}

resetCapacity().catch(err => { console.error(err); process.exit(1); });
