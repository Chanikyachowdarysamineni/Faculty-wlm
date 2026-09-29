const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI)
.then(async () => {
  const db = mongoose.connection.db;
  const user = await db.collection('users').find({ empId: { $in: ['189', 189] } }).toArray();
  console.log(JSON.stringify(user, null, 2));
  process.exit(0);
});
