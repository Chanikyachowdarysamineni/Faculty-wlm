require('dotenv').config();
const { mongoose, connect } = require('./src/db');
require('./src/models/Workload');
require('./src/models/CourseAllocation');
const Workload = mongoose.model('Workload');
const CourseAllocation = mongoose.model('CourseAllocation');

async function testAllocation() {
  try {
    await connect();
    
    console.log('Testing Workload Creation (Supporting Faculty)...');
    
    // We try to create a Workload WITHOUT faculty, course, and sectionRef to simulate POST /workloads
    const doc = new Workload({
      empId: 'TEST-123',
      courseId: 9999,
      year: 'IV',
      section: '51',
      facultyRole: 'Supporting Faculty',
    });
    
    const err = doc.validateSync();
    if (err) {
      console.error('Workload Validation Error:', err.message);
    } else {
      console.log('Workload Validation Passed!');
    }
    
    console.log('Testing CourseAllocation Validation...');
    const doc2 = new CourseAllocation({
      courseId: 9999,
      year: 'IV',
      section: '51',
      subjectCode: 'TEST',
      subjectName: 'TEST'
    });
    const err2 = doc2.validateSync();
    if (err2) {
      console.error('CourseAllocation Validation Error:', err2.message);
    } else {
      console.log('CourseAllocation Validation Passed!');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

testAllocation();
