/**
 * scripts/test-all-features.js
 * 
 * End-to-end verification script testing all API features and data loading endpoints using Supertest.
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const request = require('supertest');
const app = require('../src/index');

async function testAll() {
  console.log('=== STARTING ALL-FEATURE VERIFICATION ===\n');

  // Give Mongoose & AuthSync time to initialize
  await new Promise((r) => setTimeout(r, 4000));

  let passed = 0;
  let failed = 0;

  const testEndpoint = async (name, path, method = 'GET', body = null, headers = {}, expectedStatus = 200) => {
    try {
      let req;
      if (method === 'POST') req = request(app).post(path);
      else if (method === 'PUT') req = request(app).put(path);
      else if (method === 'PATCH') req = request(app).patch(path);
      else req = request(app).get(path);

      if (headers) {
        Object.entries(headers).forEach(([k, v]) => req.set(k, v));
      }

      if (body) {
        req.send(body);
      }

      const res = await req;

      if (res.status === expectedStatus || (expectedStatus === 200 && res.status >= 200 && res.status < 300)) {
        console.log(`✅ [${name}] PASS (Status: ${res.status})`);
        passed++;
        return res.body;
      } else {
        console.error(`❌ [${name}] FAIL (Status: ${res.status}, Expected: ${expectedStatus})`, res.body || res.text);
        failed++;
        return null;
      }
    } catch (err) {
      console.error(`❌ [${name}] ERROR:`, err.message);
      failed++;
      return null;
    }
  };

  // 1. Health Checks
  await testEndpoint('Health Check (/deva/health)', '/deva/health');
  await testEndpoint('Health Check Proxy Rewrite (/csefaculty/deva/health)', '/csefaculty/deva/health');

  // 2. Auth Login
  const loginRes = await testEndpoint(
    'Admin Login (/deva/auth/login)',
    '/deva/auth/login',
    'POST',
    { employeeId: 'admin', password: process.env.ADMIN_PASSWORD || 'admin@123' }
  );

  const token = loginRes?.data?.token || '';
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  if (!token) {
    console.error('❌ Could not obtain admin token. Halting authenticated tests.');
    process.exit(1);
  }

  // 3. Faculty List
  const facultyRes = await testEndpoint('Get Faculty (/deva/faculty)', '/deva/faculty', 'GET', null, authHeader);
  console.log(`   ℹ️ Faculty Count: ${facultyRes?.data?.length || facultyRes?.meta?.total || 0}`);

  const facultyProxyRes = await testEndpoint('Get Faculty via Proxy Path (/csefaculty/deva/faculty)', '/csefaculty/deva/faculty', 'GET', null, authHeader);
  console.log(`   ℹ️ Proxy Path Faculty Count: ${facultyProxyRes?.data?.length || facultyProxyRes?.meta?.total || 0}`);

  // 4. Courses List
  const coursesRes = await testEndpoint('Get Courses (/deva/courses)', '/deva/courses', 'GET', null, authHeader);
  console.log(`   ℹ️ Courses Count: ${coursesRes?.data?.length || coursesRes?.meta?.total || 0}`);

  // 5. Workloads List
  const workloadsRes = await testEndpoint('Get Workloads (/deva/workloads)', '/deva/workloads', 'GET', null, authHeader);
  console.log(`   ℹ️ Workloads Count: ${workloadsRes?.data?.length || workloadsRes?.meta?.total || 0}`);

  // 6. Allocations List
  const allocationsRes = await testEndpoint('Get Allocations (/deva/allocations)', '/deva/allocations', 'GET', null, authHeader);
  console.log(`   ℹ️ Allocations Count: ${allocationsRes?.data?.length || allocationsRes?.meta?.total || 0}`);

  // 7. Submissions List
  const submissionsRes = await testEndpoint('Get Submissions (/deva/submissions)', '/deva/submissions', 'GET', null, authHeader);
  console.log(`   ℹ️ Submissions Count: ${submissionsRes?.data?.length || submissionsRes?.meta?.total || 0}`);

  // 8. Sections Config
  await testEndpoint('Get Sections (/deva/sections)', '/deva/sections', 'GET', null, authHeader);

  // 9. Dashboard Analytics
  await testEndpoint('Get Dashboard Analytics (/deva/stats/dashboard-analytics)', '/deva/stats/dashboard-analytics?year=All', 'GET', null, authHeader);

  // 10. Form & Edit Settings
  await testEndpoint('Get Form Status (/deva/settings/form-status)', '/deva/settings/form-status', 'GET', null, authHeader);
  await testEndpoint('Get Edit Status (/deva/settings/edit-status)', '/deva/settings/edit-status', 'GET', null, authHeader);

  // 11. Designations
  await testEndpoint('Get Designations (/deva/designations)', '/deva/designations', 'GET', null, authHeader);

  console.log(`\n=== VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED ===`);
  process.exit(failed > 0 ? 1 : 0);
}

testAll();
