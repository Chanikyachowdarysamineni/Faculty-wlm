#!/usr/bin/env node
'use strict';

const mongoose = require('mongoose');
const Faculty = require('../models/Faculty');
const Course = require('../models/Course');
const Workload = require('../models/Workload');
const Submission = require('../models/Submission');
const CourseAllocation = require('../models/CourseAllocation');
require('dotenv').config({ path: '.env' });

const createIndexes = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);

    console.log('📍 Creating indexes...\n');
    
    // Faculty indexes
    await Faculty.collection.createIndex({ empId: 1 }, { unique: true, background: true });
    await Faculty.collection.createIndex({ name: 1 }, { background: true });
    console.log('✅ Faculty indexes created');

    // Course indexes
    await Course.collection.createIndex({ courseId: 1 }, { unique: true, background: true });
    await Course.collection.createIndex({ program: 1 }, { background: true });
    await Course.collection.createIndex({ year: 1 }, { background: true });
    console.log('✅ Course indexes created');

    // Workload indexes
    await Workload.collection.createIndex({ empId: 1 }, { background: true });
    await Workload.collection.createIndex({ courseId: 1 }, { background: true });
    await Workload.collection.createIndex({ year: 1, section: 1 }, { background: true });
    await Workload.collection.createIndex({ createdAt: -1 }, { background: true });
    console.log('✅ Workload indexes created');

    // Submission indexes
    await Submission.collection.createIndex({ empId: 1 }, { unique: true, background: true });
    console.log('✅ Submission indexes created');

    // CourseAllocation indexes
    await CourseAllocation.collection.createIndex(
      { courseId: 1, year: 1, section: 1 },
      { unique: true, background: true }
    );
    console.log('✅ CourseAllocation indexes created');

    console.log('\n✨ All indexes created successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating indexes:', err.message);
    process.exit(1);
  }
};

createIndexes();
