require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { connect } = require('../db');
const Faculty = require('../models/Faculty');
const Workload = require('../models/Workload');
const CourseAllocation = require('../models/CourseAllocation');
const Course = require('../models/Course');

async function testStats() {
  try {
    await connect();
    const matchStage = {};

    const [facultyList, workloadAgg, courseAllocations, courses] = await Promise.all([
      Faculty.find().lean(),
      Workload.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$empId',
            name: { $first: '$empName' },
            designation: { $first: '$designation' },
            courseCount: { $sum: 1 },
            assignedHours: { 
              $sum: { 
                $add: [
                  { $ifNull: ['$manualL', { $ifNull: ['$fixedL', 0] }] }, 
                  { $ifNull: ['$manualT', { $ifNull: ['$fixedT', 0] }] }, 
                  { $ifNull: ['$manualP', { $ifNull: ['$fixedP', 0] }] }
                ] 
              } 
            },
          }
        }
      ]),
      CourseAllocation.find(matchStage).lean(),
      Course.find({}).lean(),
    ]);

    console.log('Workload Aggregation Output:', workloadAgg.slice(0, 5));
    process.exit(0);
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}

testStats();
