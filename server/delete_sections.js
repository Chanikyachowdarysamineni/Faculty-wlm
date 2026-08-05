require('dotenv').config();
const mongoose = require('mongoose');
const Setting = require('./src/models/Setting');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await Setting.deleteOne({ key: 'sections_config' });
    console.log("Deleted sections_config");
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
