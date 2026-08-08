const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');
    const db = mongoose.connection.db;
    
    try {
      await db.collection('courses').dropIndex('subjectCode_1_courseType_1');
      console.log('Successfully dropped the unique index subjectCode_1_courseType_1');
    } catch (err) {
      if (err.codeName === 'IndexNotFound') {
        console.log('Index subjectCode_1_courseType_1 does not exist, nothing to do.');
      } else {
        console.error('Error dropping index:', err.message);
      }
    }
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });
