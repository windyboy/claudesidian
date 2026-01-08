# OpenCode Migration Utilities

This directory contains comprehensive migration utilities for transitioning from Claude Code to OpenCode architecture.

## Overview

The migration system consists of four main components:

1. **Migration Utilities** (`migration-utilities.ts`) - Core migration logic
2. **Settings Preservation** (`settings-preservation.ts`) - Backup and restore user settings
3. **Backward Compatibility** (`backward-compatibility.ts`) - Maintain existing functionality
4. **Migration Orchestrator** (`migration-orchestrator.ts`) - Coordinate the complete process

## Quick Start

### Option 1: Use the Shell Script (Recommended)

```bash
# Run a dry run first to see what would be migrated
bash .scripts/migrate-to-opencode.sh --dry-run

# Run the actual migration
bash .scripts/migrate-to-opencode.sh

# Run with specific options
bash .scripts/migrate-to-opencode.sh --migration-mode strict --no-backup
```

### Option 2: Use the TypeScript Orchestrator Directly

```bash
# With ts-node (if available)
npx ts-node .opencode/plugin/migration-orchestrator.ts --dry-run

# With tsx (if available)
npx tsx .opencode/plugin/migration-orchestrator.ts --dry-run

# Compile and run with Node.js
npx tsc .opencode/plugin/migration-orchestrator.ts --target es2020 --module commonjs --outDir temp --skipLibCheck
node temp/migration-orchestrator.js --dry-run
rm -rf temp
```

## Migration Options

### Command Line Arguments

- `--dry-run` - Simulate migration without making changes
- `--migration-mode <mode>` - Set migration mode: `strict`, `permissive`, `legacy` (default: `permissive`)
- `--no-backup` - Skip settings backup creation
- `--no-compatibility` - Disable backward compatibility layer
- `--workspace <path>` - Specify workspace root directory
- `--help` - Show help message

### Migration Modes

- **Strict**: Only migrate essential configurations, minimal compatibility
- **Permissive**: Balance between migration and compatibility (default)
- **Legacy**: Maximum backward compatibility, preserve all legacy features

## What Gets Migrated

### Configuration Files

- `.claude/settings.json` → OpenCode plugin configurations
- `.claude/claude_config.json` → `opencode.jsonc` with agent configurations
- Existing `opencode.jsonc` → Merged with migrated settings

### Commands

- `.claude/commands/*.md` → `.opencode/command/*.md` with OpenCode frontmatter
- Automatic agent assignment based on command content analysis
- Command shortcuts preserved as compatibility plugin

### Hooks

- Claude Code session hooks → OpenCode session plugins
- Legacy hook execution maintained through compatibility layer

### Settings and Preferences

- User preferences backed up and preserved
- Plugin settings maintained
- Vault structure analysis and preservation

## Backward Compatibility Features

### Vault Structure Compatibility

- Preserves existing Obsidian vault structure
- Maintains PARA method organization
- Protects custom folder structures

### Command Compatibility

- Maps Claude Code commands to OpenCode equivalents
- Maintains command shortcuts through compatibility plugin
- Preserves command behavior and functionality

### Legacy Hook Support

- Converts session hooks to OpenCode plugins
- Maintains hook execution order and behavior
- Provides fallback for unsupported hook types

## Generated Files and Reports

### Migration Reports

- `.opencode/complete-migration-report.md` - Comprehensive migration summary
- `.opencode/migration-report.md` - Core migration details
- `.opencode/compatibility-report.md` - Backward compatibility analysis

### Configuration Files

- `.opencode/vault-compatibility.json` - Vault structure analysis
- `.opencode/command-mappings.json` - Command compatibility mappings
- `.opencode/user-preferences.json` - Preserved user settings

### Backup Files

- `.opencode/migration-backup/` - Automatic backups of original files
- `.opencode/settings-backup/` - Timestamped settings backups
- Backup files include restoration instructions

### Generated Plugins

- `vault-compatibility.ts` - Vault structure awareness
- `shortcut-compatibility.ts` - Command shortcut support
- `hook-compatibility.ts` - Legacy hook execution
- `session-hooks.ts` - Migrated session hooks

## Testing the Migration

### Pre-Migration Testing

```bash
# Test migration utilities
bash .scripts/test-migration.sh

# Run dry run to preview changes
bash .scripts/migrate-to-opencode.sh --dry-run
```

### Post-Migration Validation

1. **Test OpenCode functionality:**
   ```bash
   opencode --version
   opencode /help
   ```

2. **Verify commands work:**
   ```bash
   opencode /thinking-partner
   opencode /inbox-processor
   ```

3. **Check vault structure:**
   - Verify all folders are intact
   - Test file operations
   - Confirm PARA structure is preserved

4. **Test shortcuts (if enabled):**
   - Try original Claude Code shortcuts
   - Verify they expand to full commands

## Troubleshooting

### Common Issues

1. **Migration fails with permission errors:**
   - Ensure write permissions to workspace
   - Check if files are locked by other processes
   - Run as administrator if necessary (Windows)

2. **Commands not working after migration:**
   - Check `.opencode/command-mappings.json`
   - Verify command files have proper frontmatter
   - Test with full command paths: `/command-name`

3. **Shortcuts not working:**
   - Check if `shortcut-compatibility.ts` plugin exists
   - Verify shortcut mappings in the plugin
   - Test individual shortcuts

4. **Vault structure issues:**
   - Check `.opencode/vault-compatibility.json`
   - Verify folder permissions
   - Test file operations in each folder

### Recovery Options

1. **Restore from backup:**
   ```bash
   # List available backups
   node -e "
   const { SettingsPreservation } = require('./.opencode/plugin/settings-preservation.ts');
   const preservation = new SettingsPreservation(process.cwd());
   preservation.listBackups().then(backups => {
     backups.forEach(backup => console.log(backup.timestamp, backup.path));
   });
   "
   
   # Restore from specific backup
   node -e "
   const { SettingsPreservation } = require('./.opencode/plugin/settings-preservation.ts');
   const preservation = new SettingsPreservation(process.cwd());
   preservation.restoreFromBackup('path/to/backup.json');
   "
   ```

2. **Rollback migration:**
   ```bash
   # Using the orchestrator
   node -e "
   const { MigrationOrchestrator } = require('./.opencode/plugin/migration-orchestrator.ts');
   const orchestrator = new MigrationOrchestrator();
   orchestrator.rollback();
   "
   ```

3. **Manual restoration:**
   - Restore files from `.opencode/migration-backup/`
   - Copy back original `.claude/` directory
   - Remove generated `.opencode/` files if needed

## Advanced Usage

### Custom Migration Configuration

```typescript
import { MigrationOrchestrator } from './migration-orchestrator'

const orchestrator = new MigrationOrchestrator({
  workspaceRoot: '/path/to/project',
  preserveSettings: true,
  enableBackwardCompatibility: true,
  compatibilityConfig: {
    enableClaudeCodeCommands: true,
    preserveVaultStructure: true,
    maintainShortcuts: true,
    enableLegacyHooks: true,
    migrationMode: 'permissive'
  },
  dryRun: false,
  skipBackup: false
})

const result = await orchestrator.migrate()
console.log('Migration result:', result)
```

### Individual Component Usage

```typescript
// Use migration utilities directly
import { MigrationUtilities } from './migration-utilities'
const migration = new MigrationUtilities('/path/to/workspace')
const result = await migration.migrate()

// Use settings preservation
import { SettingsPreservation } from './settings-preservation'
const preservation = new SettingsPreservation('/path/to/workspace')
const backup = await preservation.createSettingsBackup()

// Use backward compatibility
import { BackwardCompatibilityLayer } from './backward-compatibility'
const compatibility = new BackwardCompatibilityLayer('/path/to/workspace')
await compatibility.initialize()
```

## Support and Documentation

### Getting Help

1. **Check migration reports** for detailed error information
2. **Review backup files** to understand what was preserved
3. **Test individual components** to isolate issues
4. **Create issues** with migration reports attached

### Additional Resources

- [OpenCode Documentation](https://opencode.ai/docs)
- [Migration Guide](../MIGRATION-GUIDE.md)
- [Agent Configuration](../AGENTS.md)
- [Permission System](../PERMISSION-SYSTEM.md)

### Contributing

To improve the migration utilities:

1. Test with different vault configurations
2. Report issues with detailed migration reports
3. Suggest improvements for compatibility features
4. Contribute additional migration patterns

---

**Migration Utilities Version:** 1.0.0  
**Compatible with:** OpenCode v1.0+, Claude Code v0.13+  
**Last Updated:** January 2026