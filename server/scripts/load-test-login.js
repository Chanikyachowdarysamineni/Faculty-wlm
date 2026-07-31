const http = require('http');
const https = require('https');

const API_URL = 'http://localhost:5000/deva/auth/login';
// Provide an existing empId to test real auth (ensure server is running)
const TEST_EMP_ID = '905'; // A common admin id
const TEST_PASSWORD = '905';

async function performLogin(id) {
  const start = Date.now();
  return new Promise((resolve) => {
    const data = JSON.stringify({ employeeId: TEST_EMP_ID, password: TEST_PASSWORD });
    const req = http.request(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          id,
          status: res.statusCode,
          time: Date.now() - start,
          body: body.substring(0, 100) // keep it short
        });
      });
    });
    
    req.on('error', (e) => {
      resolve({ id, status: 'ERROR', time: Date.now() - start, body: e.message });
    });
    
    req.write(data);
    req.end();
  });
}

async function runLoadTest(concurrentUsers) {
  console.log(`\n--- Starting Load Test: ${concurrentUsers} concurrent logins ---`);
  const promises = [];
  
  for (let i = 0; i < concurrentUsers; i++) {
    promises.push(performLogin(i));
  }
  
  const results = await Promise.all(promises);
  
  const successCount = results.filter(r => r.status === 200).length;
  const authFailedCount = results.filter(r => r.status === 401).length;
  const rateLimitCount = results.filter(r => r.status === 429).length;
  const errorCount = results.filter(r => r.status === 'ERROR' || r.status >= 500).length;
  
  const times = results.map(r => r.time);
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  
  console.log(`Results for ${concurrentUsers} concurrent requests:`);
  console.log(`- Success (200): ${successCount}`);
  console.log(`- Auth Failed (401 - still means server responded): ${authFailedCount}`);
  console.log(`- Rate Limited (429): ${rateLimitCount}`);
  console.log(`- Server Errors/Timeouts: ${errorCount}`);
  console.log(`- Response Times: Min ${minTime}ms | Max ${maxTime}ms | Avg ${Math.round(avgTime)}ms`);
}

async function main() {
  await runLoadTest(5);
  await new Promise(r => setTimeout(r, 2000));
  await runLoadTest(25);
  await new Promise(r => setTimeout(r, 2000));
  await runLoadTest(100);
}

main().catch(console.error);
