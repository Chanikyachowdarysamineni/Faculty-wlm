require('dotenv').config();
const jwt = require('jsonwebtoken');

// Generate a valid test token
const token = jwt.sign(
  { id: 'TEST-ADMIN', role: 'admin', designation: 'Admin' },
  process.env.JWT_SECRET || 'fallback-secret-key-for-development-only-12345',
  { expiresIn: '1h' }
);

async function testFetch() {
  console.log('--- TEST 1: GET /deva/courses?page=&_t=1786253686189 ---');
  let res1 = await fetch('http://localhost:5000/deva/courses?page=&_t=1786253686189', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`Status: ${res1.status}`);
  console.log(await res1.json());
}

testFetch();
