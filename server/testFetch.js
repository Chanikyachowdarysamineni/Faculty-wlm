const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IlRFU1QtQURNSU4iLCJyb2xlIjoiYWRtaW4iLCJkZXNpZ25hdGlvbiI6IkFkbWluIiwiaWF0IjoxNzg2MjU0MDEyLCJleHAiOjE3ODYyNTc2MTJ9.5pO1haxcM35zGIaWEizYxD2YnImyrNHTxv2-mtHdquM';

async function testFetch() {
  console.log('--- TEST 1: GET /deva/courses?page=1&_t=1786253686189 ---');
  let res1 = await fetch('http://localhost:5000/deva/courses?page=1&_t=1786253686189', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`Status: ${res1.status}`);
  console.log(await res1.json());
  
  console.log('\n--- TEST 2: GET /deva/courses (No query params) ---');
  let res2 = await fetch('http://localhost:5000/deva/courses', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`Status: ${res2.status}`);
  console.log(await res2.json());
}

testFetch();
