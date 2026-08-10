require('dotenv').config();
const jwt = require('jsonwebtoken');

// Generate a valid test token
const token = jwt.sign(
  { id: 'TEST-ADMIN', role: 'admin', designation: 'Admin' },
  process.env.JWT_SECRET || 'fallback-secret-key-for-development-only-12345',
  { expiresIn: '1h' }
);
console.log(token);
