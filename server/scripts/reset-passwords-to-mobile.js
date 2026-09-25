'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

const MONGO_URI = process.env.MONGO_URI;
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

async function run() {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is missing in .env');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    const users = await User.find({});
    console.log(`Found ${users.length} users.`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      const mobile = (user.mobile || '').trim();
      if (!mobile) {
        console.log(`Skipping user ${user.empId} (${user.name}) - no mobile number`);
        skippedCount++;
        continue;
      }

      const passwordHash = await bcrypt.hash(mobile, BCRYPT_ROUNDS);
      await User.updateOne(
        { _id: user._id },
        { 
          $set: { 
            passwordHash,
            forcePasswordChange: false 
          },
          $inc: { tokenVersion: 1 }
        }
      );
      
      console.log(`Updated password for ${user.empId} to mobile: ${mobile}`);
      updatedCount++;
    }

    console.log(`\nMigration complete. Updated: ${updatedCount}, Skipped: ${skippedCount}`);

  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

run();
