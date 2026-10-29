const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../../src/index'); 
const User = require('../../src/models/User');
const jwt = require('jsonwebtoken');

let mongoServer;

jest.setTimeout(120000);

beforeAll(async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(uri);
  } catch (err) {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
  }

  // Seed or upsert a valid user for auth checks
  await User.findOneAndUpdate(
    { empId: 'test-admin' },
    {
      $set: {
        name: 'Admin User',
        passwordHash: 'dummyHashedPassword',
        role: 'admin',
        canAccessAdmin: true,
      }
    },
    { upsert: true }
  );
}, 120000);

afterAll(async () => {
  try {
    await User.deleteOne({ empId: 'test-admin' });
    if (mongoServer) {
      await mongoServer.stop();
    }
    await mongoose.disconnect();
  } catch {}
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
