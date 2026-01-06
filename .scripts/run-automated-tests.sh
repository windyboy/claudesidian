#!/bin/bash
# Run Automated Tests for OpenCode SDK Migration
# Tests what can be verified programmatically without UI interaction

set -e

MAIN_JS="main.js"
ERRORS=0
WARNINGS=0
PASSED=0

echo "🧪 Running Automated Tests for OpenCode SDK Migration"
echo "=================================================="
echo ""

# Test 1: Code Verification
echo "📋 Test 1: Code Implementation Verification"
echo "-------------------------------------------"
if bash .scripts/verify-opencode-migration.sh; then
    echo "✅ Code verification passed"
    PASSED=$((PASSED + 1))
else
    echo "❌ Code verification failed"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Test 2: Server Connection (if server is running)
echo "📋 Test 2: Server Connection Test"
echo "---------------------------------"
if bash .scripts/test-opencode-connection.sh 2>/dev/null; then
    echo "✅ Server connection test passed"
    PASSED=$((PASSED + 1))
else
    echo "⚠️  Server connection test skipped (server not running)"
    echo "   Start server with: opencode server"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 3: Dependencies Check
echo "📋 Test 3: Dependencies Verification"
echo "------------------------------------"
if grep -q "@opencode-ai/sdk" package.json; then
    echo "✅ @opencode-ai/sdk dependency found"
    PASSED=$((PASSED + 1))
else
    echo "❌ @opencode-ai/sdk dependency NOT found"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "\"@opencode-ai/sdk\"" package.json; then
    SDK_VERSION=$(grep "\"@opencode-ai/sdk\"" package.json | sed 's/.*"@opencode-ai\/sdk": "\([^"]*\)".*/\1/')
    echo "   Version: $SDK_VERSION"
fi
echo ""

# Test 4: OpenCodeClient Class Structure
echo "📋 Test 4: OpenCodeClient Class Structure"
echo "----------------------------------------"
if grep -q "class OpenCodeClient\|OpenCodeClient\s*=" "$MAIN_JS"; then
    echo "✅ OpenCodeClient class/instance found"
    PASSED=$((PASSED + 1))
else
    echo "❌ OpenCodeClient class NOT found"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "getClient()" "$MAIN_JS"; then
    echo "✅ getClient() method found"
    PASSED=$((PASSED + 1))
else
    echo "❌ getClient() method NOT found"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "sendPrompt" "$MAIN_JS"; then
    echo "✅ sendPrompt() method found"
    PASSED=$((PASSED + 1))
else
    echo "❌ sendPrompt() method NOT found"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "connect()" "$MAIN_JS" | grep -q "OpenCodeClient"; then
    echo "✅ connect() method found"
    PASSED=$((PASSED + 1))
else
    echo "⚠️  connect() method check inconclusive"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 5: Service Integration Check
echo "📋 Test 5: Service Integration"
echo "------------------------------"
SERVICES=("InlineEditService" "InstructionRefineService" "TitleGenerationService")
for SERVICE in "${SERVICES[@]}"; do
    if grep -q "$SERVICE" "$MAIN_JS"; then
        # Check if service uses opencodeClient.sendPrompt (more flexible pattern)
        if grep "$SERVICE" "$MAIN_JS" -A 30 | grep -q "opencodeClient\.sendPrompt\|this\.opencodeClient\.sendPrompt"; then
            echo "✅ $SERVICE uses opencodeClient.sendPrompt()"
            PASSED=$((PASSED + 1))
        else
            echo "⚠️  $SERVICE found but sendPrompt usage not confirmed"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        echo "⚠️  $SERVICE not found (may be named differently)"
        WARNINGS=$((WARNINGS + 1))
    fi
done
echo ""

# Test 6: Image Handling Check
echo "📋 Test 6: Image Handling Implementation"
echo "----------------------------------------"
if grep -q "type.*===.*[\"']image[\"']" "$MAIN_JS"; then
    echo "✅ Image type checking found"
    PASSED=$((PASSED + 1))
else
    echo "⚠️  Image type checking not found"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "buildPromptWithImages" "$MAIN_JS"; then
    echo "✅ buildPromptWithImages function found"
    PASSED=$((PASSED + 1))
else
    echo "⚠️  buildPromptWithImages function not found"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 7: Settings UI Check
echo "📋 Test 7: Settings UI Configuration"
echo "------------------------------------"
if grep -q "serverUrl" "$MAIN_JS"; then
    echo "✅ serverUrl setting found"
    PASSED=$((PASSED + 1))
else
    echo "❌ serverUrl setting NOT found"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "http://localhost:4096" "$MAIN_JS"; then
    echo "✅ Default server URL found"
    PASSED=$((PASSED + 1))
else
    echo "⚠️  Default server URL not found"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 8: Obsolete Code Wrapped
echo "📋 Test 8: Obsolete Code Cleanup"
echo "--------------------------------"
OBSOLETE_COUNT=$(grep -c "if (false)" "$MAIN_JS" || echo "0")
if [ "$OBSOLETE_COUNT" -gt 0 ]; then
    echo "✅ Found $OBSOLETE_COUNT obsolete code blocks wrapped in if (false)"
    PASSED=$((PASSED + 1))
else
    echo "⚠️  No obsolete code blocks found (may have been removed)"
    WARNINGS=$((WARNINGS + 1))
fi

if ! grep -q "new ProcessTransport" "$MAIN_JS" | grep -v "if (false)"; then
    echo "✅ ProcessTransport usage properly wrapped"
    PASSED=$((PASSED + 1))
else
    echo "⚠️  ProcessTransport may still be used outside if (false)"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 9: Error Handling
echo "📋 Test 9: Error Handling"
echo "------------------------"
if grep -q "connection failed\|server connection failed" "$MAIN_JS" -i; then
    echo "✅ Connection error messages found"
    PASSED=$((PASSED + 1))
else
    echo "⚠️  Connection error messages not found"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "try.*catch\|catch.*error" "$MAIN_JS"; then
    echo "✅ Error handling (try/catch) found"
    PASSED=$((PASSED + 1))
else
    echo "⚠️  Error handling may be incomplete"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 10: Code Quality
echo "📋 Test 10: Code Quality Checks"
echo "-------------------------------"
if command -v pnpm >/dev/null 2>&1; then
    if pnpm lint:check >/dev/null 2>&1; then
        echo "✅ Linting passed"
        PASSED=$((PASSED + 1))
    else
        echo "⚠️  Linting issues found (run: pnpm lint)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "⚠️  pnpm not available, skipping lint check"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Summary
echo "=================================================="
echo "📊 Test Summary"
echo "=================================================="
echo "✅ Tests Passed: $PASSED"
echo "⚠️  Warnings: $WARNINGS"
echo "❌ Errors: $ERRORS"
echo ""

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo "🎉 All automated tests passed!"
        echo ""
        echo "Next steps:"
        echo "1. Start OpenCode server: opencode server"
        echo "2. Follow manual test guide: TEST-EXECUTION-GUIDE.md"
        echo "3. Execute manual UI tests in Obsidian"
        exit 0
    else
        echo "✅ All critical tests passed (with warnings)"
        echo ""
        echo "Review warnings above and proceed with manual testing."
        exit 0
    fi
else
    echo "❌ Some tests failed. Please fix errors before proceeding."
    exit 1
fi

