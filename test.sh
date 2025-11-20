#!/bin/bash

# Better Text Pad - Automated Pre-Deployment Test Script
# Run this before pushing to remote main branch

set -e  # Exit on any error

echo "=================================="
echo "Better Text Pad - Pre-Deployment Tests"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test result
test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC} - $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC} - $2"
        ((TESTS_FAILED++))
    fi
}

echo "📋 Running automated tests..."
echo ""

# Test 1: Check if package.json exists
echo "1. Checking package.json..."
if [ -f "package.json" ]; then
    test_result 0 "package.json exists"
else
    test_result 1 "package.json not found"
    exit 1
fi

# Test 2: Check if node_modules exists
echo ""
echo "2. Checking dependencies..."
if [ -d "node_modules" ]; then
    test_result 0 "node_modules folder exists"
else
    echo -e "${YELLOW}⚠ WARNING${NC} - node_modules not found, running npm install..."
    npm install
    test_result $? "npm install"
fi

# Test 3: Check required files exist
echo ""
echo "3. Checking required files..."
REQUIRED_FILES=(
    "src/BetterTextPad.jsx"
    "src/main.jsx"
    "src/index.css"
    "index.html"
    "package.json"
    "vite.config.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        test_result 0 "File exists: $file"
    else
        test_result 1 "File missing: $file"
    fi
done

# Test 4: Check for required dependencies
echo ""
echo "4. Checking critical dependencies..."
REQUIRED_DEPS=(
    "react"
    "react-dom"
    "lucide-react"
    "marked"
)

for dep in "${REQUIRED_DEPS[@]}"; do
    if grep -q "\"$dep\"" package.json; then
        test_result 0 "Dependency found: $dep"
    else
        test_result 1 "Dependency missing: $dep"
    fi
done

# Test 5: Build the project
echo ""
echo "5. Building production version..."
if npm run build > /tmp/build.log 2>&1; then
    test_result 0 "Production build successful"
else
    test_result 1 "Production build failed"
    echo "Build log:"
    cat /tmp/build.log
fi

# Test 6: Check build output
echo ""
echo "6. Checking build output..."
if [ -d "dist" ]; then
    test_result 0 "dist folder created"

    # Check build size
    BUILD_SIZE=$(du -sh dist/ | cut -f1)
    echo "   Build size: $BUILD_SIZE"

    # Check for required files in dist
    if [ -f "dist/index.html" ]; then
        test_result 0 "dist/index.html exists"
    else
        test_result 1 "dist/index.html missing"
    fi
else
    test_result 1 "dist folder not created"
fi

# Test 7: Check for common issues
echo ""
echo "7. Checking for common issues..."

# Check for console.log statements (excluding specific allowed ones)
if grep -r "console\.log" src/ --exclude-dir=node_modules | grep -v "console\.error\|console\.warn" > /dev/null; then
    test_result 1 "Found console.log statements in source code"
    echo "   Please remove debug console.log statements"
else
    test_result 0 "No debug console.log statements found"
fi

# Check for TODO comments
TODO_COUNT=$(grep -r "TODO\|FIXME\|HACK" src/ --exclude-dir=node_modules | wc -l)
if [ $TODO_COUNT -gt 0 ]; then
    echo -e "${YELLOW}⚠ WARNING${NC} - Found $TODO_COUNT TODO/FIXME/HACK comments"
else
    test_result 0 "No TODO/FIXME/HACK comments"
fi

# Test 8: Check git status
echo ""
echo "8. Checking git status..."
if git diff --quiet; then
    test_result 0 "No uncommitted changes"
else
    echo -e "${YELLOW}⚠ WARNING${NC} - You have uncommitted changes"
    git status --short
fi

# Test 9: Check branch
echo ""
echo "9. Checking git branch..."
CURRENT_BRANCH=$(git branch --show-current)
echo "   Current branch: $CURRENT_BRANCH"
if [ "$CURRENT_BRANCH" = "main" ]; then
    test_result 0 "On main branch"
else
    echo -e "${YELLOW}⚠ INFO${NC} - Not on main branch"
fi

# Test 10: Lint check (if ESLint is configured)
echo ""
echo "10. Running linter (if available)..."
if grep -q "\"lint\"" package.json; then
    if npm run lint > /tmp/lint.log 2>&1; then
        test_result 0 "Linting passed"
    else
        test_result 1 "Linting failed"
        echo "Lint errors:"
        cat /tmp/lint.log
    fi
else
    echo "   ⊘ Linting not configured (skipping)"
fi

# Summary
echo ""
echo "=================================="
echo "Test Summary"
echo "=================================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo ""
    echo "Ready to push to remote! Run:"
    echo "  git push origin main"
    echo ""
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    echo "Please fix the failing tests before pushing to remote."
    echo ""
    exit 1
fi
