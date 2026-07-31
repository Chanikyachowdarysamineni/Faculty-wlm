require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { connect } = require('../db');
const Faculty = require('../models/Faculty');

async function checkCapacity() {
  await connect();
  const counts = await Faculty.aggregate([{ $group: { _id: '$capacity', count: { $sum: 1 } } }]);
  console.log('Capacity distribution:', JSON.stringify(counts));
  process.exit(0);
}
checkCapacity().catch(err => { console.error(err); process.exit(1); });
