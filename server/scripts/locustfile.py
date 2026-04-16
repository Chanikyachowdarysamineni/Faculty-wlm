"""
Locust load testing script for WLM Login API
Python-based load testing with web UI and headless modes

Installation:
  pip install locust

Usage:
  # Web UI (http://localhost:8089)
  locust -f scripts/locustfile.py -H http://localhost:5000

  # Headless: 300 users, spawn rate 10/sec, 3 minute test
  locust -f scripts/locustfile.py -H http://localhost:5000 \\
    --users 300 --spawn-rate 10 --run-time 3m --headless

  # Cloud testing with csv export
  locust -f scripts/locustfile.py -H http://localhost:5000 \\
    --csv=results --headless --users 300 --spawn-rate 20 --run-time 5m
"""

from locust import HttpUser, task, between, events
from locust.contrib.fasthttp import FastHttpUser
from random import choice, random
import json
import time
import logging

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────

TEST_FACULTY = [
    {"employeeId": "FAC001", "password": "TestPassword123!"},
    {"employeeId": "FAC002", "password": "TestPassword123!"},
    {"employeeId": "FAC003", "password": "TestPassword123!"},
    {"employeeId": "FAC004", "password": "TestPassword123!"},
    {"employeeId": "FAC005", "password": "TestPassword123!"},
]

# Metrics tracking
login_success = 0
login_failure = 0
rate_limit_count = 0
response_times = []

# ──────────────────────────────────────────────────────────
# Events (hooks for metrics collection)
# ──────────────────────────────────────────────────────────

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    logger.info(f"🚀 Locust load test starting: {environment.host}")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    logger.info(f"✅ Locust test completed")
    logger.info(f"   Successes: {login_success}")
    logger.info(f"   Failures: {login_failure}")
    logger.info(f"   Rate Limited: {rate_limit_count}")
    if response_times:
        avg_time = sum(response_times) / len(response_times)
        max_time = max(response_times)
        min_time = min(response_times)
        logger.info(f"   Avg response: {avg_time:.2f}ms | Min: {min_time:.2f}ms | Max: {max_time:.2f}ms")


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, response, context, exception, **kwargs):
    global login_success, login_failure, rate_limit_count, response_times

    response_times.append(response_time)

    # Keep only last 1000 response times to avoid memory bloat
    if len(response_times) > 1000:
        response_times.pop(0)

    if request_type == "http" and "login" in name.lower():
        if response and response.status_code == 200:
            login_success += 1
        elif response and response.status_code == 429:
            rate_limit_count += 1
            login_failure += 1
        else:
            login_failure += 1


# ──────────────────────────────────────────────────────────
# User Classes (different user behavior patterns)
# ──────────────────────────────────────────────────────────

class WLMUser(HttpUser):
    """
    Simulates a faculty member logging in with realistic delays
    
    Tasks:
    - Login (primary task)
    - Occasional password reset request
    
    Wait behavior: Random between 1-3 seconds (think time)
    """

    wait_time = between(1, 3)

    def on_start(self):
        """Called when a simulated user starts"""
        self.faculty = choice(TEST_FACULTY)
        logger.debug(f"User started with faculty: {self.faculty['employeeId']}")

    @task(weight=20)
    def login(self):
        """
        Main task: Login
        Weight 20 means runs 20x more often than other tasks
        """
        payload = {
            "employeeId": self.faculty["employeeId"],
            "password": self.faculty["password"],
        }

        start_time = time.time()
        response = self.client.post(
            "/deva/auth/login",
            json=payload,
            timeout=10,
            name="POST /deva/auth/login",
        )
        elapsed = (time.time() - start_time) * 1000  # Convert to ms

        if response.status_code == 200:
            logger.debug(f"✅ Login successful: {self.faculty['employeeId']} ({elapsed:.0f}ms)")
        elif response.status_code == 429:
            logger.warning(f"⚠️  Rate limited: {self.faculty['employeeId']}")
        else:
            logger.error(f"❌ Login failed: {response.status_code} - {response.text}")

    @task(weight=1)
    def password_reset_request(self):
        """
        Optional task: Request password reset
        Weight 1 means runs 1x compared to login (rarely)
        """
        payload = {
            "email": f"{self.faculty['employeeId']}@example.com",
        }

        response = self.client.post(
            "/deva/auth/forgot-password",
            json=payload,
            timeout=5,
            name="POST /deva/auth/forgot-password",
        )

        if response.status_code == 200:
            logger.debug(f"Password reset requested for {self.faculty['employeeId']}")


class StressTestUser(FastHttpUser):
    """
    Fast HTTP user for stress testing
    
    Uses FastHttpClient (async) for maximum throughput
    Minimal think time = more aggressive load
    """

    wait_time = between(0.1, 1)  # Very short think time

    def on_start(self):
        self.faculty = choice(TEST_FACULTY)

    @task
    def login_stress(self):
        """Aggressive login stress test"""
        payload = json.dumps({
            "employeeId": self.faculty["employeeId"],
            "password": self.faculty["password"],
        })

        self.client.post(
            "/deva/auth/login",
            data=payload,
            headers={"Content-Type": "application/json"},
            timeout=5,
            name="POST /deva/auth/login [stress]",
        )


class PeakHourUser(HttpUser):
    """
    Simulates peak hour login rush
    
    - Fast connections (0.5-1.5s think time)
    - Occasional retries on failure
    - Mix of login and session validation
    """

    wait_time = between(0.5, 1.5)

    def on_start(self):
        self.faculty = choice(TEST_FACULTY)
        self.token = None

    @task(weight=80)
    def login_peak(self):
        """Peak hour login"""
        payload = {
            "employeeId": self.faculty["employeeId"],
            "password": self.faculty["password"],
        }

        response = self.client.post(
            "/deva/auth/login",
            json=payload,
            timeout=10,
            name="POST /deva/auth/login [peak]",
        )

        if response.status_code == 200:
            try:
                data = response.json()
                self.token = data.get("token")
            except:
                pass

    @task(weight=20)
    def validate_session(self):
        """Check current user session"""
        if self.token:
            headers = {"Authorization": f"Bearer {self.token}"}
            self.client.get(
                "/deva/auth/me",
                headers=headers,
                timeout=5,
                name="GET /deva/auth/me",
            )


# ──────────────────────────────────────────────────────────
# Advanced Scenario (Ramp-up and Ramp-down)
# ──────────────────────────────────────────────────────────

class LoadTestShape:
    """
    Define custom load shape for realistic load patterns
    
    Usage in Locust: locust -f scripts/locustfile.py --shape
    """

    def tick(self):
        """
        Return (user_count, spawning_rate) tuple
        Returns None when test should stop
        """
        run_time = self.get_run_time()

        # Phase 1: Ramp up to 100 users over 60 seconds
        if run_time < 60:
            user_count = int((run_time / 60.0) * 100)
            return (user_count, 2)

        # Phase 2: Ramp up to 300 users over next 60 seconds
        elif run_time < 120:
            user_count = 100 + int(((run_time - 60) / 60.0) * 200)
            return (user_count, 5)

        # Phase 3: Hold at 300 for 60 seconds (peak traffic)
        elif run_time < 180:
            return (300, 0)

        # Phase 4: Ramp down to 50 over 30 seconds
        elif run_time < 210:
            user_count = max(50, int(300 - ((run_time - 180) / 30.0) * 250))
            return (user_count, 5)

        # Test complete
        else:
            return None

    def get_run_time(self):
        """Get elapsed time since test start"""
        # This would be implemented by Locust's environment
        return 0  # Placeholder


# ──────────────────────────────────────────────────────────
# CLI Examples
# ──────────────────────────────────────────────────────────

"""
Example command-line usage:

1. Web UI (Interactive):
   locust -f scripts/locustfile.py -H http://localhost:5000
   Open: http://localhost:8089

2. 300 users, normal behavior:
   locust -f scripts/locustfile.py -H http://localhost:5000 \\
     --users 300 --spawn-rate 10 --run-time 5m --headless

3. Stress test (fast, aggressive):
   locust -f scripts/locustfile.py::StressTestUser \\
     -H http://localhost:5000 \\
     --users 500 --spawn-rate 50 --run-time 3m --headless

4. Peak hour scenario:
   locust -f scripts/locustfile.py::PeakHourUser \\
     -H http://localhost:5000 \\
     --users 300 --spawn-rate 20 --run-time 5m --headless

5. Export results to CSV:
   locust -f scripts/locustfile.py -H http://localhost:5000 \\
     --csv=results --headless --users 200 --spawn-rate 10 --run-time 3m

6. Web UI with custom shape:
   locust -f scripts/locustfile.py -H http://localhost:5000 --shape
"""
