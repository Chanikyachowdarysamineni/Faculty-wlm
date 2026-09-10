const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../../src/index'); 
const User = require('../../src/models/User');
const jwt = require('jsonwebtoken');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  await mongoose.connect(uri);

  // Seed a valid user for auth checks
  await User.create({
    empId: 'test-admin',
    name: 'Admin User',
    password: 'Password123!',
    role: 'admin'
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Critical Paths: Auth & JWT Security', () => {

  test('Should reject JWTs signed with "none" algorithm', async () => {
    // A malicious actor might try to send an unsigned token with algorithm 'none'
    const unsignedToken = jwt.sign(
      { id: 'test-admin', role: 'admin', empId: 'test-admin' }, 
      process.env.JWT_SECRET || 'test-secret', 
      { algorithm: 'none' } // Not supported by default, but to simulate tampering
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${unsignedToken}`);

    // Since our backend strictly enforces algorithms: ['HS256'], this should fail
    expect(res.statusCode).toBe(401);
  });

  test('Should successfully authenticate with valid HS256 JWT', async () => {
    const validToken = jwt.sign(
      { id: 'test-admin', role: 'admin', empId: 'test-admin' }, 
      process.env.JWT_SECRET || 'test-secret', 
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
