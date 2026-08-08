#!/usr/bin/env node
'use strict';

const mongoose = require('mongoose');
const Course = require('../models/Course');
require('dotenv').config({ path: '../.env' }); // Adjusted path for .env since we are in src/scripts

const updateIndexes = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/faculty_db'); // fallback if needed

    console.log('📍 Dropping old index...');
    try {
      await Course.collection.dropIndex('subjectCode_1');
      console.log('✅ Old index dropped');
    } catch (e) {
      if (e.code === 27) {
        console.log('⚠️ Old index not found, skipping drop.');
      } else {
        console.error('❌ Error dropping index:', e.message);
      }
    }

    console.log('📍 Creating new index...');
    await Course.collection.createIndex({ subjectCode: 1, courseType: 1 }, { unique: true, background: true });
    console.log('✅ New index created');

    console.log('\n✨ Database index updated successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error updating indexes:', err.message);
    process.exit(1);
  }
};

updateIndexes();
