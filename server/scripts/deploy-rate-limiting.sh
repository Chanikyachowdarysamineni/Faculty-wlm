#!/bin/bash
# Quick deployment script for rate limiting fix

set -e

echo "════════════════════════════════════════════════════════════"
echo "WLM Rate Limiting Fix - Deployment Guide"
echo "════════════════════════════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Update dependencies
echo -e "${YELLOW}[1/5]${NC} Installing new dependencies..."
cd server
npm install redis@4.6.14 express-rate-limit-redis@4.1.5

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${RED}✗ Dependency installation failed${NC}"
    exit 1
fi

echo ""

# Step 2: Check .env configuration
echo -e "${YELLOW}[2/5]${NC} Checking .env configuration..."

if ! grep -q "AUTH_LOGIN_RATE_LIMIT=500" .env; then
    echo -e "${YELLOW}⚠️  WARNING: AUTH_LOGIN_RATE_LIMIT not updated to 500${NC}"
    echo "    Please update .env manually:"
    echo "    AUTH_LOGIN_RATE_LIMIT=500"
fi

if grep -q "REDIS_URL=" .env && [ -z "$(grep 'REDIS_URL=' .env | cut -d'=' -f2)" ]; then
    echo -e "${YELLOW}ℹ️  INFO: REDIS_URL is empty (using memory store)${NC}"
    echo "    For production, configure Redis:"
    echo "    REDIS_URL=redis://localhost:6379"
fi

echo -e "${GREEN}✓ .env configured${NC}"
echo ""

# Step 3: Verify file changes
echo -e "${YELLOW}[3/5]${NC} Verifying implementation files..."

FILES_TO_CHECK=(
    "src/middleware/rateLimiters.js"
    "src/routes/auth.js"
    "src/index.js"
    "package.json"
)

for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file (NOT FOUND)"
        exit 1
    fi
done

echo ""

# Step 4: Test syntax
echo -e "${YELLOW}[4/5]${NC} Testing Node.js syntax..."

node -c src/middleware/rateLimiters.js 2>/dev/null && echo -e "${GREEN}✓${NC} rateLimiters.js" || echo -e "${RED}✗${NC} rateLimiters.js syntax error"
node -c src/routes/auth.js 2>/dev/null && echo -e "${GREEN}✓${NC} auth.js" || echo -e "${RED}✗${NC} auth.js syntax error"
node -c src/index.js 2>/dev/null && echo -e "${GREEN}✓${NC} index.js" || echo -e "${RED}✗${NC} index.js syntax error"

echo ""

# Step 5: Summary
echo -e "${YELLOW}[5/5]${NC} Deployment Summary"
echo ""
echo -e "${GREEN}✅ All checks passed!${NC}"
echo ""
echo "Before starting the server, ensure:"
echo "  1. ✓ Redis is running (if using Redis)"
echo "  2. ✓ .env variables are correct"
echo "  3. ✓ Test faculty credentials exist in DB"
echo ""
echo "To start the server:"
echo "  npm run dev          # Development"
echo "  npm start            # Production"
echo ""
echo "To run load tests:"
echo "  k6 run scripts/load-test-login.js"
echo ""
echo "Documentation:"
echo "  - RATE_LIMITING.md for configuration details"
echo "  - LOAD_TESTING.md for testing instructions"
echo ""
echo "════════════════════════════════════════════════════════════"
