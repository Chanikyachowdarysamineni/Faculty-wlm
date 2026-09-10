const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../../src/index'); 
const Workload = require('../../src/models/Workload');
const Course = require('../../src/models/Course');
const jwt = require('jsonwebtoken');

let mongoServer;
let adminToken;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  // Close any existing connection that index.js might have started
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  await mongoose.connect(uri);

  // Generate a dummy admin token using the strict HS256 config
  adminToken = jwt.sign(
    { id: 'admin-id', role: 'admin', empId: 'admin' }, 
    process.env.JWT_SECRET || 'test-secret', 
    { expiresIn: '1h', algorithm: 'HS256' }
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Workload.deleteMany({});
  await Course.deleteMany({});
});

describe('Critical Paths: Workload Validation & Concurrency', () => {
  
  test('Should reject workload hours that are not positive integers', async () => {
    const res = await request(app)
      .post('/api/workloads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        empId: 'emp01',
        courseId: '100',
        year: 'I',
        section: '1',
        facultyRole: 'Main Faculty',
        manualL: -5, // Invalid negative hours
        manualT: 2.5, // Invalid float
        manualP: 0
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('Should enforce unique Main Faculty per course, section, and year (Race Condition Check)', async () => {
    // Setup a valid course
    const course = await Course.create({
      courseId: '100',
      courseName: 'Test Course',
      program: 'B.Tech',
      year: 'I',
      courseType: 'Mandatory',
      fixedL: 3, fixedT: 0, fixedP: 0,
      credits: 3
    });

    // Create a Main Faculty workload
    await Workload.create({
      empId: 'emp01',
      empName: 'First Main',
      courseId: course.courseId,
      year: 'I',
      section: '1',
      facultyRole: 'Main Faculty',
      manualL: 3, manualT: 0, manualP: 0
    });

    // Attempting to create a second Main Faculty workload for the exact same parameters
    // Should trigger MongoDB unique constraint duplicate error (11000)
    const res = await request(app)
      .post('/api/workloads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        empId: 'emp02',
        empName: 'Second Main',
        courseId: course.courseId,
        year: 'I',
        section: '1',
        facultyRole: 'Main Faculty',
        manualL: 3, manualT: 0, manualP: 0
      });

    // In errorHandler.js we return 409 for 11000 duplicate keys or 400 for validation
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
    
    // Ensure only 1 was created
    const count = await Workload.countDocuments({ 
      courseId: course.courseId, 
      section: '1', 
      facultyRole: 'Main Faculty' 
    });
    expect(count).toBe(1);
  });
});
