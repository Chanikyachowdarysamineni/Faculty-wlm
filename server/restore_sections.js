require('dotenv').config();
const mongoose = require('mongoose');
const Setting = require('./src/models/Setting');

const previousConfig = {
  "I":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19"],
  "II":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19"],
  "III":["2","3","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","4","1"],
  "IV":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","51","52","53","54","55","56","57","58","59"],
  "M.Tech":["1","2"]
};

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await Setting.findOneAndUpdate(
      { key: 'sections_config' },
      { $set: { value: JSON.stringify(previousConfig) } },
      { upsert: true }
    );
    console.log("Restored sections_config");
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
