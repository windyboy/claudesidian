#!/bin/bash

# OpenCode Migration Script
# Migrates Claude Code configuration to OpenCode format using the Migration Orchestrator

set -e

echo "🚀 OpenCode Migration Script"
echo "============================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: This script must be run from the project root directory"
    echo "   Make sure you're in the directory containing package.json"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed or not in PATH"
    echo "   Please install Node.js to run the migration"
    exit 1
fi

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx is not available"
    echo "   Please ensure npm/npx is properly installed"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Parse command line arguments
DRY_RUN=false
MIGRATION_MODE="permissive"
NO_BACKUP=false
NO_COMPATIBILITY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --migration-mode)
            MIGRATION_MODE="$2"
            shift 2
            ;;
        --no-backup)
            NO_BACKUP=true
            shift
            ;;
        --no-compatibility)
            NO_COMPATIBILITY=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --dry-run              Simulate migration without making changes"
            echo "  --migration-mode MODE  Set migration mode: strict, permissive, legacy (default: permissive)"
            echo "  --no-backup           Skip settings backup creation"
            echo "  --no-compatibility    Disable backward compatibility layer"
            echo "  --help                Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Standard migration"
            echo "  $0 --dry-run                         # Test migration without changes"
            echo "  $0 --migration-mode strict           # Strict migration mode"
            echo "  $0 --no-backup --no-compatibility   # Minimal migration"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Display migration configuration
echo "📋 Migration Configuration:"
echo "   Dry run: $DRY_RUN"
echo "   Migration mode: $MIGRATION_MODE"
echo "   Create backup: $([ "$NO_BACKUP" = true ] && echo "No" || echo "Yes")"
echo "   Backward compatibility: $([ "$NO_COMPATIBILITY" = true ] && echo "No" || echo "Yes")"
echo ""

# Confirm migration (unless dry run)
if [ "$DRY_RUN" = false ]; then
    echo "⚠️  This will modify your configuration files."
    echo "   Backups will be created automatically (unless --no-backup is used)."
    echo ""
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Migration cancelled."
        exit 0
    fi
    echo ""
fi

# Build migration command arguments
MIGRATION_ARGS=""
[ "$DRY_RUN" = true ] && MIGRATION_ARGS="$MIGRATION_ARGS --dry-run"
[ "$NO_BACKUP" = true ] && MIGRATION_ARGS="$MIGRATION_ARGS --no-backup"
[ "$NO_COMPATIBILITY" = true ] && MIGRATION_ARGS="$MIGRATION_ARGS --no-compatibility"
MIGRATION_ARGS="$MIGRATION_ARGS --migration-mode $MIGRATION_MODE"

echo "🔄 Running migration orchestrator..."
echo ""

# Run the migration using the orchestrator
if command -v ts-node &> /dev/null; then
    echo "   Using ts-node to run migration orchestrator..."
    npx ts-node .opencode/plugin/migration-orchestrator.ts $MIGRATION_ARGS
elif [ -f "node_modules/.bin/tsx" ]; then
    echo "   Using tsx to run migration orchestrator..."
    npx tsx .opencode/plugin/migration-orchestrator.ts $MIGRATION_ARGS
else
    echo "   Compiling TypeScript and running with Node.js..."
    # Create temporary directory for compilation
    mkdir -p .opencode/temp
    
    # Compile the TypeScript files
    npx tsc .opencode/plugin/migration-orchestrator.ts \
        .opencode/plugin/migration-utilities.ts \
        .opencode/plugin/settings-preservation.ts \
        .opencode/plugin/backward-compatibility.ts \
        --target es2020 \
        --module commonjs \
        --outDir .opencode/temp \
        --skipLibCheck \
        --esModuleInterop \
        --allowSyntheticDefaultImports
    
    # Run the compiled JavaScript
    node .opencode/temp/migration-orchestrator.js $MIGRATION_ARGS
    
    # Clean up temporary files
    rm -rf .opencode/temp
fi

MIGRATION_EXIT_CODE=$?

echo ""

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo ""
    
    if [ "$DRY_RUN" = false ]; then
        echo "📋 Next steps:"
        echo "1. Review the migration report: .opencode/complete-migration-report.md"
        echo "2. Test OpenCode functionality:"
        echo "   - Run: opencode"
        echo "   - Test commands: /command-name"
        echo "3. Verify your vault structure is intact"
        echo "4. If everything works, consider removing Claude Code files:"
        echo "   - .claude/settings.json"
        echo "   - .claude/claude_config.json"
        echo "   - .claude/commands/ (after verifying OpenCode commands work)"
        echo ""
        echo "📖 For more information:"
        echo "   - Migration report: .opencode/complete-migration-report.md"
        echo "   - Compatibility report: .opencode/compatibility-report.md"
        echo "   - OpenCode documentation: https://opencode.ai/docs"
    else
        echo "🔍 Dry run completed - no changes were made."
        echo "   Review the simulated results and run without --dry-run to perform the actual migration."
    fi
    
    echo ""
    echo "🎉 Welcome to OpenCode!"
else
    echo "❌ Migration failed!"
    echo ""
    echo "📋 Troubleshooting:"
    echo "1. Check the migration report for detailed error information"
    echo "2. Review any backup files that were created"
    echo "3. If you need to rollback, restore from the backup files"
    echo "4. Report issues with the migration report attached"
    echo ""
    echo "📄 Reports location: .opencode/"
    
    exit 1
fi