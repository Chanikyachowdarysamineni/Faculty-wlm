#!/bin/bash
# Load testing commands for WLM Login API
# Supports: k6, Apache JMeter, wrk, and curl-based concurrent testing

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:5000}"
API_ENDPOINT="${BASE_URL}/deva/auth/login"
CONCURRENT_USERS="${CONCURRENT_USERS:-50}"
DURATION="${DURATION:-2m}"

echo "════════════════════════════════════════════════════════════"
echo "WLM Login Load Testing Guide"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Base URL: $BASE_URL"
echo "Endpoint: $API_ENDPOINT"
echo ""

# ──────────────────────────────────────────────────────────
# Option 1: k6 (Recommended - Easy to use, great metrics)
# ──────────────────────────────────────────────────────────

test_with_k6() {
    echo "📊 Running load test with k6..."
    echo ""
    echo "Installation:"
    echo "  Windows: choco install k6"
    echo "  macOS:   brew install k6"
    echo "  Linux:   sudo apt-get install k6"
    echo ""
    echo "Commands:"
    echo "  # 50 concurrent, 2 minutes (default)"
    echo "  k6 run scripts/load-test-login.js"
    echo ""
    echo "  # 150 concurrent users (peak)"
    echo "  BASE_URL=$BASE_URL k6 run --vus 150 --duration 3m scripts/load-test-login.js"
    echo ""
    echo "  # 300+ concurrent (extreme)"
    echo "  BASE_URL=$BASE_URL k6 run --vus 300 --duration 5m scripts/load-test-login.js"
    echo ""
    echo "  # Export results to JSON"
    echo "  k6 run --out json=results.json scripts/load-test-login.js"
    echo ""
    echo "  # Cloud testing (requires k6 account)"
    echo "  k6 cloud load-test-login.js"
    echo ""
}

# ──────────────────────────────────────────────────────────
# Option 2: Apache JMeter
# ──────────────────────────────────────────────────────────

test_with_jmeter() {
    echo "🔧 Running load test with Apache JMeter..."
    echo ""
    echo "Installation:"
    echo "  Download: https://jmeter.apache.org/download_jmeter.cgi"
    echo "  Extract and add bin/ to PATH"
    echo ""
    echo "Usage:"
    echo "  # GUI mode"
    echo "  jmeter -t scripts/load-test-login.jmx"
    echo ""
    echo "  # Headless (command-line)"
    echo "  jmeter -n -t scripts/load-test-login.jmx -l results.csv -j jmeter.log"
    echo ""
    echo "  # With 300 threads, 3m duration"
    echo "  jmeter -n -t scripts/load-test-login.jmx -Jnum_threads=300 -Jduration=180000 -l results.csv"
    echo ""
}

# ──────────────────────────────────────────────────────────
# Option 3: wrk (Simple, fast, C-based)
# ──────────────────────────────────────────────────────────

test_with_wrk() {
    echo "⚡ Running load test with wrk..."
    echo ""
    echo "Installation:"
    echo "  macOS:  brew install wrk"
    echo "  Linux:  apt-get install wrk"
    echo "  Windows: Use WSL or pre-built binary"
    echo ""
    echo "Commands:"
    echo "  # 50 connections, 4 threads, 2 minute test"
    echo "  wrk -t4 -c50 -d2m -s scripts/wlm-login.lua $API_ENDPOINT"
    echo ""
    echo "  # 200 connections (peak)"
    echo "  wrk -t8 -c200 -d2m -s scripts/wlm-login.lua $API_ENDPOINT"
    echo ""
    echo "  # 300+ connections (extreme)"
    echo "  wrk -t16 -c300 -d3m -s scripts/wlm-login.lua $API_ENDPOINT"
    echo ""
}

# ──────────────────────────────────────────────────────────
# Option 4: curl (Simple bash loop - no installation needed)
# ──────────────────────────────────────────────────────────

test_with_curl_bash() {
    echo "🔗 Running load test with curl (bash loop)..."
    echo ""
    echo "Simple concurrent test:"
    echo "  # 50 concurrent logins (runs in background)"
    echo "  for i in {1..50}; do"
    echo "    curl -X POST '$API_ENDPOINT' \\"
    echo "      -H 'Content-Type: application/json' \\"
    echo "      -d '{\"employeeId\":\"FAC001\",\"password\":\"TestPassword123!\"}' &"
    echo "  done"
    echo ""
    echo "  # Wait for all to complete"
    echo "  wait"
    echo ""
    echo "  # Get timing info"
    echo "  curl -w '@curl-format.txt' -o /dev/null -s '$API_ENDPOINT'"
    echo ""
}

# ──────────────────────────────────────────────────────────
# Option 5: Apache Bench (ab) - Simplest for HTTP requests
# ──────────────────────────────────────────────────────────

test_with_apache_bench() {
    echo "🪁 Running load test with Apache Bench..."
    echo ""
    echo "Installation:"
    echo "  Usually comes with Apache: apt-get install apache2-utils"
    echo ""
    echo "Commands:"
    echo "  # 50 concurrent, 1000 requests total"
    echo "  ab -n 1000 -c 50 '$API_ENDPOINT'"
    echo ""
    echo "  # 200 concurrent, 5000 requests"
    echo "  ab -n 5000 -c 200 '$API_ENDPOINT'"
    echo ""
    echo "⚠️  Note: ab only works with GET requests by default."
    echo "     For POST, use k6, wrk, or JMeter instead."
    echo ""
}

# ──────────────────────────────────────────────────────────
# Option 6: Locust (Python-based, great for complex scenarios)
# ──────────────────────────────────────────────────────────

test_with_locust() {
    echo "🦗 Running load test with Locust..."
    echo ""
    echo "Installation:"
    echo "  pip install locust"
    echo ""
    echo "Usage:"
    echo "  # Run with web UI (http://localhost:8089)"
    echo "  locust -f scripts/locust-tasks.py -H $BASE_URL"
    echo ""
    echo "  # Headless: 300 users, spawn rate 10/sec, 3 minute test"
    echo "  locust -f scripts/locust-tasks.py -H $BASE_URL \\"
    echo "    --users 300 --spawn-rate 10 --run-time 3m --headless"
    echo ""
}

# ──────────────────────────────────────────────────────────
# Print all options
# ──────────────────────────────────────────────────────────

case "${1:-all}" in
  k6)
    test_with_k6
    ;;
  jmeter)
    test_with_jmeter
    ;;
  wrk)
    test_with_wrk
    ;;
  curl)
    test_with_curl_bash
    ;;
  ab)
    test_with_apache_bench
    ;;
  locust)
    test_with_locust
    ;;
  all|"")
    test_with_k6
    echo ""
    test_with_jmeter
    echo ""
    test_with_wrk
    echo ""
    test_with_curl_bash
    echo ""
    test_with_apache_bench
    echo ""
    test_with_locust
    ;;
  *)
    echo "Unknown option: $1"
    echo ""
    echo "Usage: $0 [k6|jmeter|wrk|curl|ab|locust|all]"
    exit 1
    ;;
esac

echo "════════════════════════════════════════════════════════════"
echo "Recommended: Use k6 (scripts/load-test-login.js)"
echo "It has the best metrics, easiest setup, and cloud options."
echo "════════════════════════════════════════════════════════════"
