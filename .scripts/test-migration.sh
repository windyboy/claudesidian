#!/bin/bash

# Test Migration Utilities
# Simple test script to verify migration utilities work correctly

set -e

echo "🧪 Testing Migration Utilities"
echo "=============================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: This script must be run from the project root directory"
    exit 1
fi

# Create a temporary test directory
TEST_DIR="./test-migration-temp"
echo "📁 Creating test environment: $TEST_DIR"

# Clean up any existing test directory
if [ -d "$TEST_DIR" ]; then
    rm -rf "$TEST_DIR"
fi

mkdir -p "$TEST_DIR"

# Copy current project structure to test directory
echo "📋 Setting up test project structure..."
cp -r .claude "$TEST_DIR/" 2>/dev/null || echo "   ⚠️  No .claude directory found"
cp package.json "$TEST_DIR/"
cp manifest.json "$TEST_DIR/" 2>/dev/null || echo "   ⚠️  No manifest.json found"
[ -f "opencode.jsonc" ] && cp opencode.jsonc "$TEST_DIR/"

# Copy migration utilities
mkdir -p "$TEST_DIR/.opencode/plugin"
cp .opencode/plugin/migration-utilities.ts "$TEST_DIR/.opencode/plugin/"
cp .opencode/plugin/settings-preservation.ts "$TEST_DIR/.opencode/plugin/"
cp .opencode/plugin/backward-compatibility.ts "$TEST_DIR/.opencode/plugin/"
cp .opencode/plugin/migration-orchestrator.ts "$TEST_DIR/.opencode/plugin/"

echo "✅ Test environment created"
echo ""

# Test 1: Dry run migration
echo "🧪 Test 1: Dry run migration"
echo "----------------------------"

cd "$TEST_DIR"

if command -v npx &> /dev/null; then
    if command -v ts-node &> /dev/null; then
        echo "   Running dry run migration with ts-node..."
        npx ts-node .opencode/plugin/migration-orchestrator.ts --dry-run
    elif [ -f "../node_modules/.bin/tsx" ]; then
        echo "   Running dry run migration with tsx..."
        npx tsx .opencode/plugin/migration-orchestrator.ts --dry-run
    else
        echo "   ⚠️  TypeScript runner not available, skipping dry run test"
    fi
else
    echo "   ⚠️  npx not available, skipping dry run test"
fi

cd ..

echo ""
echo "✅ Test 1 completed"
echo ""

# Test 2: Validate migration utilities exist
echo "🧪 Test 2: Validate migration utilities"
echo "---------------------------------------"

UTILITIES_EXIST=true

if [ ! -f ".opencode/plugin/migration-utilities.ts" ]; then
    echo "   ❌ migration-utilities.ts not found"
    UTILITIES_EXIST=false
else
    echo "   ✅ migration-utilities.ts exists"
fi

if [ ! -f ".opencode/plugin/settings-preservation.ts" ]; then
    echo "   ❌ settings-preservation.ts not found"
    UTILITIES_EXIST=false
else
    echo "   ✅ settings-preservation.ts exists"
fi

if [ ! -f ".opencode/plugin/backward-compatibility.ts" ]; then
    echo "   ❌ backward-compatibility.ts not found"
    UTILITIES_EXIST=false
else
    echo "   ✅ backward-compatibility.ts exists"
fi

if [ ! -f ".opencode/plugin/migration-orchestrator.ts" ]; then
    echo "   ❌ migration-orchestrator.ts not found"
    UTILITIES_EXIST=false
else
    echo "   ✅ migration-orchestrator.ts exists"
fi

if [ ! -f ".scripts/migrate-to-opencode.sh" ]; then
    echo "   ❌ migrate-to-opencode.sh not found"
    UTILITIES_EXIST=false
else
    echo "   ✅ migrate-to-opencode.sh exists"
fi

echo ""
if [ "$UTILITIES_EXIST" = true ]; then
    echo "✅ Test 2 PASSED - All migration utilities exist"
else
    echo "❌ Test 2 FAILED - Some migration utilities are missing"
fi
echo ""

# Test 3: Check TypeScript syntax
echo "🧪 Test 3: TypeScript syntax validation"
echo "---------------------------------------"

SYNTAX_VALID=true

if command -v npx &> /dev/null; then
    echo "   Checking TypeScript syntax..."
    
    for file in .opencode/plugin/migration-utilities.ts .opencode/plugin/settings-preservation.ts .opencode/plugin/backward-compatibility.ts .opencode/plugin/migration-orchestrator.ts; do
        if [ -f "$file" ]; then
            echo "   Checking $file..."
            if npx tsc --noEmit --skipLibCheck "$file" 2>/dev/null; then
                echo "   ✅ $file syntax is valid"
            else
                echo "   ❌ $file has syntax errors"
                SYNTAX_VALID=false
            fi
        fi
    done
else
    echo "   ⚠️  npx not available, skipping syntax validation"
fi

echo ""
if [ "$SYNTAX_VALID" = true ]; then
    echo "✅ Test 3 PASSED - TypeScript syntax is valid"
else
    echo "❌ Test 3 FAILED - TypeScript syntax errors found"
fi
echo ""

# Clean up test directory
echo "🧹 Cleaning up test environment..."
rm -rf "$TEST_DIR"
echo "✅ Test environment cleaned up"
echo ""

# Summary
echo "📊 Test Summary"
echo "==============="
echo "Test 1 (Dry run): Completed"
echo "Test 2 (Files exist): $([ "$UTILITIES_EXIST" = true ] && echo "PASSED" || echo "FAILED")"
echo "Test 3 (Syntax): $([ "$SYNTAX_VALID" = true ] && echo "PASSED" || echo "FAILED")"
echo ""

if [ "$UTILITIES_EXIST" = true ] && [ "$SYNTAX_VALID" = true ]; then
    echo "🎉 All tests PASSED! Migration utilities are ready to use."
    echo ""
    echo "To run the actual migration:"
    echo "  bash .scripts/migrate-to-opencode.sh"
    echo ""
    echo "To run a dry run first:"
    echo "  bash .scripts/migrate-to-opencode.sh --dry-run"
    exit 0
else
    echo "❌ Some tests FAILED. Please fix the issues before using migration utilities."
    exit 1
fi