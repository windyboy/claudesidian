#!/bin/bash
# Test OpenCode Server Connection
# Verifies that OpenCode server is running and accessible

set -e

DEFAULT_URL="http://localhost:4096"
SERVER_URL="${1:-$DEFAULT_URL}"

echo "🔍 Testing OpenCode server connection..."
echo "Server URL: $SERVER_URL"
echo ""

# Test health endpoint
echo "1. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$SERVER_URL/health" || echo "000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health check passed (HTTP $HTTP_CODE)"
    echo "   Response: $BODY"
else
    echo "❌ Health check failed (HTTP $HTTP_CODE)"
    echo "   Response: $BODY"
    echo ""
    echo "💡 Make sure OpenCode server is running:"
    echo "   opencode server"
    exit 1
fi

echo ""
echo "2. Testing server connectivity..."
if curl -s --max-time 5 "$SERVER_URL/health" > /dev/null; then
    echo "✅ Server is reachable"
else
    echo "❌ Server is not reachable"
    exit 1
fi

echo ""
echo "✅ All connection tests passed!"
echo ""
echo "Next steps:"
echo "1. Open Obsidian"
echo "2. Enable Claudesidian plugin"
echo "3. Verify server URL in settings: $SERVER_URL"
echo "4. Send a test query"

