#!/bin/bash
# Verify OpenCode SDK Migration Implementation
# Checks that all migration fixes are in place

set -e

MAIN_JS="main.js"
ERRORS=0

echo "🔍 Verifying OpenCode SDK migration implementation..."
echo ""

# Check 1: getClient() method exists
echo "1. Checking getClient() method..."
if grep -q "getClient()" "$MAIN_JS"; then
    echo "   ✅ getClient() method found"
else
    echo "   ❌ getClient() method NOT found"
    ERRORS=$((ERRORS + 1))
fi

# Check 2: queryViaSDK uses OpenCodeClient (not createOpencodeClient directly)
echo "2. Checking queryViaSDK uses OpenCodeClient..."
QUERY_VIA_SDK_LINE=$(grep -n "async \*queryViaSDK" "$MAIN_JS" | head -1 | cut -d: -f1)
if [ -n "$QUERY_VIA_SDK_LINE" ]; then
    END_LINE=$((QUERY_VIA_SDK_LINE + 25))
    if sed -n "${QUERY_VIA_SDK_LINE},${END_LINE}p" "$MAIN_JS" | grep -q "opencodeClient.connect()"; then
        echo "   ✅ queryViaSDK uses opencodeClient.connect()"
    elif sed -n "${QUERY_VIA_SDK_LINE},${END_LINE}p" "$MAIN_JS" | grep -q "opencodeClient.getClient()"; then
        echo "   ✅ queryViaSDK uses opencodeClient.getClient()"
    else
        echo "   ❌ queryViaSDK may not use OpenCodeClient properly"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "   ⚠️  Could not find queryViaSDK method"
    ERRORS=$((ERRORS + 1))
fi

# Check 3: No duplicate createOpencodeClient in queryViaSDK
echo "3. Checking for duplicate client creation in queryViaSDK..."
QUERY_VIA_SDK_LINE=$(grep -n "async \*queryViaSDK" "$MAIN_JS" | cut -d: -f1)
if [ -n "$QUERY_VIA_SDK_LINE" ]; then
    # Check next 20 lines for createOpencodeClient
    END_LINE=$((QUERY_VIA_SDK_LINE + 20))
    if sed -n "${QUERY_VIA_SDK_LINE},${END_LINE}p" "$MAIN_JS" | grep -q "createOpencodeClient"; then
        echo "   ⚠️  Warning: createOpencodeClient found in queryViaSDK (should use getClient())"
        ERRORS=$((ERRORS + 1))
    else
        echo "   ✅ No duplicate client creation found"
    fi
else
    echo "   ⚠️  Could not find queryViaSDK method"
fi

# Check 4: Image handling in queryViaSDK
echo "4. Checking image handling in queryViaSDK..."
if grep -A 15 "Convert prompt to parts format" "$MAIN_JS" | grep -q "block.type === \"image\""; then
    echo "   ✅ Image handling found in queryViaSDK"
else
    echo "   ❌ Image handling NOT found in queryViaSDK"
    ERRORS=$((ERRORS + 1))
fi

# Check 5: Image handling in sendPrompt
echo "5. Checking image handling in sendPrompt..."
if grep -A 20 "Convert prompt to parts format, handling both string and array inputs" "$MAIN_JS" | grep -q "item.type === \"image\""; then
    echo "   ✅ Image handling found in sendPrompt"
else
    echo "   ❌ Image handling NOT found in sendPrompt"
    ERRORS=$((ERRORS + 1))
fi

# Check 6: OpenCodeClient class exists
echo "6. Checking OpenCodeClient class..."
if grep -q "var OpenCodeClient = class" "$MAIN_JS"; then
    echo "   ✅ OpenCodeClient class found"
else
    echo "   ❌ OpenCodeClient class NOT found"
    ERRORS=$((ERRORS + 1))
fi

# Check 7: Deprecated code wrapped in if (false)
echo "7. Checking deprecated code is wrapped..."
if grep -q "if (false)" "$MAIN_JS"; then
    WRAPPED_COUNT=$(grep -c "if (false)" "$MAIN_JS" || echo "0")
    echo "   ✅ Found $WRAPPED_COUNT if (false) blocks (deprecated code wrapped)"
else
    echo "   ⚠️  No if (false) blocks found (may be okay if deprecated code removed)"
fi

# Check 8: @opencode-ai/sdk in package.json
echo "8. Checking dependencies..."
if grep -q "@opencode-ai/sdk" "package.json"; then
    SDK_VERSION=$(grep "@opencode-ai/sdk" "package.json" | sed 's/.*"@opencode-ai\/sdk": "\([^"]*\)".*/\1/')
    echo "   ✅ @opencode-ai/sdk found (version: $SDK_VERSION)"
else
    echo "   ❌ @opencode-ai/sdk NOT found in package.json"
    ERRORS=$((ERRORS + 1))
fi

# Check 9: Settings UI for serverUrl
echo "9. Checking settings UI for serverUrl..."
if grep -q "OpenCode Server URL" "$MAIN_JS"; then
    echo "   ✅ Server URL setting found in UI"
else
    echo "   ❌ Server URL setting NOT found in UI"
    ERRORS=$((ERRORS + 1))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ All verification checks passed!"
    echo ""
    echo "The code is ready for manual testing."
    echo "Run: .scripts/test-opencode-connection.sh"
    exit 0
else
    echo "❌ Found $ERRORS issue(s) that need to be fixed."
    echo ""
    echo "Please review the errors above and fix them before testing."
    exit 1
fi

