/**
 * Load Testing Script for WLM Login — k6
 * 
 * Tests concurrent login performance up to 300+ users
 * 
 * Installation:
 *   Windows: choco install k6
 *   macOS:   brew install k6
 *   Linux:   sudo apt-get install k6
 *   Docker:  docker run -i grafana/k6 run - < login-load-test.js
 * 
 * Usage:
 *   # Test 50 concurrent users, 2 minute duration, ramping up
 *   k6 run load-test-login.js
 *   
 *   # Test 300 concurrent users
 *   k6 run --vus 300 --duration 3m load-test-login.js
 *   
 *   # Cloud test (requires k6 account)
 *   k6 cloud load-test-login.js
 * 
 * Output:
 *   - Console metrics (requests/sec, error rate, p95/p99 latency)
 *   - Detailed results with pass/fail thresholds
 *   - Export to JSON: k6 run --out json=results.json load-test-login.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// ──────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const API_ENDPOINT = `${BASE_URL}/deva/auth/login`;

// Test faculty credentials (ensure these exist in your DB)
// In production, use real employee IDs from your system
const TEST_FACULTY = [
  { employeeId: 'FAC001', password: 'TestPassword123!' },
  { employeeId: 'FAC002', password: 'TestPassword123!' },
  { employeeId: 'FAC003', password: 'TestPassword123!' },
  { employeeId: 'FAC004', password: 'TestPassword123!' },
  { employeeId: 'FAC005', password: 'TestPassword123!' },
];

// ──────────────────────────────────────────────────────────
// Custom Metrics
// ──────────────────────────────────────────────────────────

const loginSuccessRate = new Rate('login_success_rate');
const loginFailureRate = new Rate('login_failure_rate');
const loginDuration = new Trend('login_duration_ms');
const rateLimitExceeded = new Counter('rate_limit_exceeded');
const concurrentLogins = new Gauge('concurrent_logins');

// ──────────────────────────────────────────────────────────
// Scenario Configuration
// ──────────────────────────────────────────────────────────

export let options = {
  scenarios: {
    // Scenario 1: Ramp up to 50 users over 30 seconds, hold for 1 minute
    rampUp50: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // Ramp up to 50 VUs
        { duration: '1m', target: 50 },    // Hold at 50 VUs
        { duration: '30s', target: 0 },    // Ramp down to 0
      ],
      gracefulRampDown: '30s',
      exec: 'loginTest',
      tags: { scenario: 'rampUp50' },
    },

    // Scenario 2: 150 concurrent users (peak hour)
    peak150: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 150 },   // Ramp up to 150 VUs
        { duration: '2m', target: 150 },   // Hold at 150 VUs
        { duration: '30s', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '30s',
      exec: 'loginTest',
      tags: { scenario: 'peak150' },
    },

    // Scenario 3: 300+ concurrent faculty (major event)
    extreme300: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },  // Ramp to 100
        { duration: '30s', target: 200 },  // Ramp to 200
        { duration: '30s', target: 300 },  // Ramp to 300
        { duration: '1m', target: 300 },   // Hold at 300
        { duration: '30s', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '30s',
      exec: 'loginTest',
      tags: { scenario: 'extreme300' },
    },
  },

  // Performance thresholds
  thresholds: {
    'login_success_rate': ['p(95) > 0.95'],           // 95%+ success
    'login_failure_rate': ['p(95) < 0.05'],           // <5% failure
    'login_duration_ms': ['p(95) < 1000', 'p(99) < 2000'], // p95 < 1s, p99 < 2s
    'rate_limit_exceeded': ['count < 50'],            // Less than 50 rate limits
    'http_req_failed': ['rate < 0.10'],               // <10% HTTP errors
  },
};

// ──────────────────────────────────────────────────────────
// Main Test Function
// ──────────────────────────────────────────────────────────

export function loginTest() {
  concurrentLogins.add(1);

  // Select random faculty credentials
  const faculty = TEST_FACULTY[Math.floor(Math.random() * TEST_FACULTY.length)];

  const payload = JSON.stringify({
    employeeId: faculty.employeeId,
    password: faculty.password,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'k6-load-test/1.0',
    },
    timeout: '10s',
  };

  group(`Login - ${faculty.employeeId}`, () => {
    const startTime = new Date().getTime();
    const response = http.post(API_ENDPOINT, payload, params);
    const endTime = new Date().getTime();
    const duration = endTime - startTime;

    loginDuration.add(duration);

    // Check response status and structure
    const success = check(response, {
      'status is 200 (success)': (r) => r.status === 200,
      'status is 401 (invalid creds)': (r) => r.status === 401,
      'status is 429 (rate limited)': (r) => r.status === 429,
      'response has token on success': (r) => {
        try {
          const body = JSON.parse(r.body);
          return r.status === 200 ? body.token && body.token.length > 0 : true;
        } catch {
          return false;
        }
      },
      'response time < 1000ms': (r) => r.timings.duration < 1000,
      'response time < 2000ms': (r) => r.timings.duration < 2000,
    });

    // Record success/failure
    if (response.status === 200) {
      loginSuccessRate.add(true);
      loginFailureRate.add(false);
    } else if (response.status === 429) {
      rateLimitExceeded.add(1);
      loginSuccessRate.add(false);
      loginFailureRate.add(true);
    } else {
      loginSuccessRate.add(false);
      loginFailureRate.add(true);
    }

    // Log detailed info on failures
    if (!success && response.status !== 429) {
      console.log(`❌ Login failed for ${faculty.employeeId}: ${response.status}`);
      console.log(`Response: ${response.body}`);
    }
  });

  // Small random delay between requests (stagger them)
  sleep(Math.random() * 2);
  concurrentLogins.add(-1);
}

// ──────────────────────────────────────────────────────────
// Setup & Teardown
// ──────────────────────────────────────────────────────────

export function setup() {
  console.log('🚀 Starting WLM Login Load Test');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   TEST_FACULTY count: ${TEST_FACULTY.length}`);
  return { startTime: new Date().toISOString() };
}

export function teardown(data) {
  console.log('✅ Load test completed');
  console.log(`   Date: ${data.startTime}`);
}
