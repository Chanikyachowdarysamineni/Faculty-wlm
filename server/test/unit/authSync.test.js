'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { syncAuthAndRBAC } = require('../../src/utils/authSync');
const Designation = require('../../src/models/Designation');
const Role = require('../../src/models/Role');

describe('syncAuthAndRBAC Unit Suite', () => {
  jest.setTimeout(30000);
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/faculty_workload');
    }
  });

  afterAll(async () => {
    // Keep connection for other tests or gracefully close if last
  });

  it('executes syncAuthAndRBAC without MongoServerError path conflict on category', async () => {
    // Should complete cleanly without error
    await expect(syncAuthAndRBAC()).resolves.not.toThrow();

    // Verify default designations have correct categories assigned
    const ta = await Designation.findOne({ name: 'Teaching Associate' }).lean();
    expect(ta).toBeTruthy();
    expect(ta.category).toBe('TA_INSTRUCTOR');

    const prof = await Designation.findOne({ name: 'Associate Professor' }).lean();
    expect(prof).toBeTruthy();
    expect(prof.category).toBe('FACULTY');

    // Running it a second time should also not conflict (idempotent upsert)
    await expect(syncAuthAndRBAC()).resolves.not.toThrow();
  });
});
