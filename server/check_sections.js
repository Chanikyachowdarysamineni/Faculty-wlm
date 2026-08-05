require('dotenv').config();
const mongoose = require('mongoose');
const Setting = require('./src/models/Setting');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const doc = await Setting.findOne({ key: 'sections_config' });
    console.log("sections_config:", doc ? doc.value : 'Not found');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
