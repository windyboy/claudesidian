/**
 * Migration Orchestrator
 * 
 * This module orchestrates the complete migration process from Claude Code to OpenCode,
 * including migration utilities, settings preservation, and backward compatibility.
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { MigrationUtilities, type MigrationResult } from './migration-utilities'
import { SettingsPreservation, type SettingsBackup } from './settings-preservation'
import { BackwardCompatibilityLayer, type CompatibilityConfig } from './backward-compatibility'

export interface MigrationOptions {
  workspaceRoot?: string
  preserveSettings?: boolean
  enableBackwardCompatibility?: boolean
  compatibilityConfig?: Partial<CompatibilityConfig>
  dryRun?: boolean
  skipBackup?: boolean
}

export interface CompleteMigrationResult {
  success: boolean
  migrationResult: MigrationResult
  settingsBackup?: SettingsBackup
  compatibilityEnabled: boolean
  dryRun: boolean
  summary: {
    filesProcessed: number
    warnings: number
    errors: number
    backupCreated: boolean
    compatibilityPluginsCreated: number
  }
  reportPath: string
}

export class MigrationOrchestrator {
  private workspaceRoot: string
  private options: Required<MigrationOptions>

  constructor(options: MigrationOptions = {}) {
    this.workspaceRoot = options.workspaceRoot || process.cwd()
    this.options = {
      workspaceRoot: this.workspaceRoot,
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
      skipBackup: false,
      ...options
    }
  }

  /**
   * Execute complete migration process
   */
  async migrate(): Promise<CompleteMigrationResult> {
    console.log('🚀 Starting complete OpenCode migration process...')
    console.log(`Workspace: ${this.workspaceRoot}`)
    console.log(`Dry run: ${this.options.dryRun ? 'Yes' : 'No'}`)
    console.log('')

    const result: CompleteMigrationResult = {
      success: false,
      migrationResult: {
        success: false,
        migratedFiles: [],
        warnings: [],
        errors: []
      },
      compatibilityEnabled: false,
      dryRun: this.options.dryRun,
      summary: {
        filesProcessed: 0,
        warnings: 0,
        errors: 0,
        backupCreated: false,
        compatibilityPluginsCreated: 0
      },
      reportPath: ''
    }

    try {
      // Phase 1: Pre-migration validation
      console.log('📋 Phase 1: Pre-migration validation')
      await this.validatePreMigration(result)

      // Phase 2: Settings backup (if enabled)
      if (this.options.preserveSettings && !this.options.skipBackup) {
        console.log('💾 Phase 2: Creating settings backup')
        await this.createSettingsBackup(result)
      }

      // Phase 3: Core migration
      console.log('🔄 Phase 3: Core migration')
      await this.executeMigration(result)

      // Phase 4: Backward compatibility setup (if enabled)
      if (this.options.enableBackwardCompatibility) {
        console.log('🔗 Phase 4: Setting up backward compatibility')
        await this.setupBackwardCompatibility(result)
      }

      // Phase 5: Post-migration validation
      console.log('✅ Phase 5: Post-migration validation')
      await this.validatePostMigration(result)

      // Phase 6: Generate comprehensive report
      console.log('📄 Phase 6: Generating migration report')
      await this.generateComprehensiveReport(result)

      // Determine overall success
      result.success = result.migrationResult.success && result.summary.errors === 0

      console.log('')
      console.log('='.repeat(60))
      console.log('MIGRATION COMPLETE')
      console.log('='.repeat(60))
      console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`)
      console.log(`Files processed: ${result.summary.filesProcessed}`)
      console.log(`Warnings: ${result.summary.warnings}`)
      console.log(`Errors: ${result.summary.errors}`)
      console.log(`Report: ${result.reportPath}`)

      return result

    } catch (error) {
      result.migrationResult.errors.push(`Migration orchestration failed: ${error.message}`)
      result.success = false
      return result
    }
  }

  /**
   * Validate pre-migration conditions
   */
  private async validatePreMigration(result: CompleteMigrationResult): Promise<void> {
    const checks = [
      { name: 'Workspace exists', check: () => fs.access(this.workspaceRoot) },
      { name: 'Package.json exists', check: () => fs.access(join(this.workspaceRoot, 'package.json')) },
      { name: 'Write permissions', check: () => fs.access(this.workspaceRoot, fs.constants.W_OK) }
    ]

    for (const { name, check } of checks) {
      try {
        await check()
        console.log(`  ✅ ${name}`)
      } catch (error) {
        const errorMsg = `Pre-migration check failed: ${name}`
        result.migrationResult.errors.push(errorMsg)
        console.log(`  ❌ ${name}`)
      }
    }

    // Check for existing Claude Code configuration
    const claudeDir = join(this.workspaceRoot, '.claude')
    try {
      await fs.access(claudeDir)
      console.log('  ✅ Claude Code configuration found')
    } catch (error) {
      result.migrationResult.warnings.push('No Claude Code configuration found - migration may be limited')
      console.log('  ⚠️  No Claude Code configuration found')
    }
  }

  /**
   * Create settings backup
   */
  private async createSettingsBackup(result: CompleteMigrationResult): Promise<void> {
    if (this.options.dryRun) {
      console.log('  🔍 [DRY RUN] Would create settings backup')
      return
    }

    try {
      const preservation = new SettingsPreservation(this.workspaceRoot)
      result.settingsBackup = await preservation.createSettingsBackup()
      result.summary.backupCreated = true
      console.log('  ✅ Settings backup created')
    } catch (error) {
      result.migrationResult.warnings.push(`Settings backup failed: ${error.message}`)
      console.log(`  ⚠️  Settings backup failed: ${error.message}`)
    }
  }

  /**
   * Execute core migration
   */
  private async executeMigration(result: CompleteMigrationResult): Promise<void> {
    if (this.options.dryRun) {
      console.log('  🔍 [DRY RUN] Would execute migration')
      // Simulate migration for dry run
      result.migrationResult = {
        success: true,
        migratedFiles: ['[DRY RUN] Simulated migration files'],
        warnings: [],
        errors: []
      }
      return
    }

    try {
      const migration = new MigrationUtilities(this.workspaceRoot)
      result.migrationResult = await migration.migrate()
      
      result.summary.filesProcessed = result.migrationResult.migratedFiles.length
      result.summary.warnings += result.migrationResult.warnings.length
      result.summary.errors += result.migrationResult.errors.length

      if (result.migrationResult.success) {
        console.log('  ✅ Core migration completed successfully')
      } else {
        console.log('  ❌ Core migration completed with errors')
      }
    } catch (error) {
      result.migrationResult.errors.push(`Core migration failed: ${error.message}`)
      console.log(`  ❌ Core migration failed: ${error.message}`)
    }
  }

  /**
   * Set up backward compatibility
   */
  private async setupBackwardCompatibility(result: CompleteMigrationResult): Promise<void> {
    if (this.options.dryRun) {
      console.log('  🔍 [DRY RUN] Would set up backward compatibility')
      result.compatibilityEnabled = true
      return
    }

    try {
      const compatibility = new BackwardCompatibilityLayer(
        this.workspaceRoot,
        this.options.compatibilityConfig
      )
      
      await compatibility.initialize()
      result.compatibilityEnabled = true

      // Count compatibility plugins created
      const pluginDir = join(this.workspaceRoot, '.opencode', 'plugin')
      const compatibilityPlugins = [
        'vault-compatibility.ts',
        'shortcut-compatibility.ts',
        'hook-compatibility.ts'
      ]

      for (const plugin of compatibilityPlugins) {
        const pluginPath = join(pluginDir, plugin)
        try {
          await fs.access(pluginPath)
          result.summary.compatibilityPluginsCreated++
        } catch (error) {
          // Plugin doesn't exist, which is fine
        }
      }

      console.log(`  ✅ Backward compatibility enabled (${result.summary.compatibilityPluginsCreated} plugins)`)
    } catch (error) {
      result.migrationResult.warnings.push(`Backward compatibility setup failed: ${error.message}`)
      console.log(`  ⚠️  Backward compatibility setup failed: ${error.message}`)
    }
  }

  /**
   * Validate post-migration state
   */
  private async validatePostMigration(result: CompleteMigrationResult): Promise<void> {
    const validations = [
      {
        name: 'OpenCode configuration exists',
        check: () => fs.access(join(this.workspaceRoot, 'opencode.jsonc'))
      },
      {
        name: 'OpenCode commands directory exists',
        check: () => fs.access(join(this.workspaceRoot, '.opencode', 'command'))
      },
      {
        name: 'OpenCode plugins directory exists',
        check: () => fs.access(join(this.workspaceRoot, '.opencode', 'plugin'))
      }
    ]

    for (const { name, check } of validations) {
      try {
        await check()
        console.log(`  ✅ ${name}`)
      } catch (error) {
        const errorMsg = `Post-migration validation failed: ${name}`
        result.migrationResult.errors.push(errorMsg)
        result.summary.errors++
        console.log(`  ❌ ${name}`)
      }
    }
  }

  /**
   * Generate comprehensive migration report
   */
  private async generateComprehensiveReport(result: CompleteMigrationResult): Promise<void> {
    const reportContent = `# Complete OpenCode Migration Report

**Migration Date:** ${new Date().toISOString()}
**Workspace:** ${this.workspaceRoot}
**Dry Run:** ${result.dryRun ? 'Yes' : 'No'}
**Overall Status:** ${result.success ? '✅ SUCCESS' : '❌ FAILED'}

## Migration Summary

- **Files Processed:** ${result.summary.filesProcessed}
- **Warnings:** ${result.summary.warnings}
- **Errors:** ${result.summary.errors}
- **Settings Backup Created:** ${result.summary.backupCreated ? 'Yes' : 'No'}
- **Backward Compatibility Enabled:** ${result.compatibilityEnabled ? 'Yes' : 'No'}
- **Compatibility Plugins Created:** ${result.summary.compatibilityPluginsCreated}

## Migration Details

### Migrated Files
${result.migrationResult.migratedFiles.map(file => `- ✅ ${file}`).join('\n')}

### Warnings
${result.migrationResult.warnings.length > 0 ? 
  result.migrationResult.warnings.map(warning => `- ⚠️ ${warning}`).join('\n') : 
  '- None'
}

### Errors
${result.migrationResult.errors.length > 0 ? 
  result.migrationResult.errors.map(error => `- ❌ ${error}`).join('\n') : 
  '- None'
}

## Settings Backup

${result.settingsBackup ? `
**Backup Created:** ${result.settingsBackup.timestamp}
**Version:** ${result.settingsBackup.version}
**Files Backed Up:** ${Object.keys(result.settingsBackup.files).length}

### Preserved Features
${result.settingsBackup.settings.migrationInfo?.preservedFeatures?.map(feature => `- ${feature}`).join('\n') || '- None'}

### Customizations
${result.settingsBackup.settings.migrationInfo?.customizations?.map(customization => `- ${customization}`).join('\n') || '- None'}
` : '- No settings backup was created'}

## Backward Compatibility

**Status:** ${result.compatibilityEnabled ? 'Enabled' : 'Disabled'}
**Plugins Created:** ${result.summary.compatibilityPluginsCreated}

${result.compatibilityEnabled ? `
The backward compatibility layer has been configured to maintain existing functionality:

- ✅ Vault structure preservation
- ✅ Command compatibility
- ✅ Shortcut mappings
- ✅ Legacy hook support

All existing workflows should continue to work as expected.
` : 'Backward compatibility was not enabled for this migration.'}

## Next Steps

${result.success ? `
### ✅ Migration Successful

1. **Test the migration:**
   - Run: \`opencode\` to start OpenCode
   - Test commands: \`/command-name\`
   - Verify vault structure is intact

2. **Review configurations:**
   - Check: \`opencode.jsonc\`
   - Review: \`.opencode/command/\` directory
   - Validate: \`.opencode/plugin/\` directory

3. **Clean up (optional):**
   - Remove Claude Code files if everything works:
     - \`.claude/settings.json\`
     - \`.claude/claude_config.json\`
     - \`.claude/commands/\` (after verifying OpenCode commands work)

4. **Update workflows:**
   - Update documentation to reference OpenCode commands
   - Train team members on new command syntax
   - Update any automation scripts

### 📚 Documentation

- [OpenCode Documentation](https://opencode.ai/docs)
- [Migration Guide](./MIGRATION-GUIDE.md)
- [Agent Configuration](./AGENTS.md)
` : `
### ❌ Migration Failed

1. **Review errors above**
2. **Check backup files:**
   - Settings backup: ${result.settingsBackup ? 'Available' : 'Not created'}
   - File backups: Check \`.opencode/migration-backup/\`

3. **Restore if needed:**
   - Restore from backup files
   - Report issues with error details

4. **Get help:**
   - Check documentation
   - Create issue with migration report
   - Contact support team
`}

## Migration Configuration

\`\`\`json
${JSON.stringify({
  workspaceRoot: this.workspaceRoot,
  options: this.options
}, null, 2)}
\`\`\`

## Troubleshooting

### Common Issues

1. **Commands not working:**
   - Check \`.opencode/command-mappings.json\`
   - Verify command files have proper frontmatter
   - Test with full command paths

2. **Shortcuts not working:**
   - Check \`.opencode/plugin/shortcut-compatibility.ts\`
   - Verify shortcut mappings are correct
   - Test individual shortcuts

3. **Vault structure issues:**
   - Check \`.opencode/vault-compatibility.json\`
   - Verify folder permissions
   - Test file operations

4. **Plugin errors:**
   - Check OpenCode plugin logs
   - Verify plugin syntax
   - Test plugins individually

### Getting Help

If you encounter issues:

1. Review this migration report
2. Check the OpenCode documentation
3. Search existing issues
4. Create a new issue with:
   - This migration report
   - Error messages
   - Steps to reproduce

---

**Migration completed at:** ${new Date().toISOString()}
**Report generated by:** OpenCode Migration Orchestrator v1.0.0
`

    const reportPath = join(this.workspaceRoot, '.opencode', 'complete-migration-report.md')
    
    try {
      await fs.mkdir(join(this.workspaceRoot, '.opencode'), { recursive: true })
      await fs.writeFile(reportPath, reportContent)
      result.reportPath = reportPath
      console.log(`  ✅ Comprehensive report generated: ${reportPath}`)
    } catch (error) {
      result.migrationResult.warnings.push(`Failed to generate report: ${error.message}`)
      console.log(`  ⚠️  Failed to generate report: ${error.message}`)
    }
  }

  /**
   * Rollback migration (restore from backup)
   */
  async rollback(backupPath?: string): Promise<void> {
    console.log('🔄 Rolling back migration...')

    if (!backupPath) {
      // Find the most recent backup
      const preservation = new SettingsPreservation(this.workspaceRoot)
      const backups = await preservation.listBackups()
      
      if (backups.length === 0) {
        throw new Error('No backups found for rollback')
      }
      
      backupPath = backups[0].path
      console.log(`Using most recent backup: ${backupPath}`)
    }

    try {
      const preservation = new SettingsPreservation(this.workspaceRoot)
      await preservation.restoreFromBackup(backupPath)
      console.log('✅ Migration rollback completed')
    } catch (error) {
      throw new Error(`Rollback failed: ${error.message}`)
    }
  }
}

/**
 * CLI interface for migration orchestrator
 */
export async function runCompleteMigration(options: MigrationOptions = {}): Promise<void> {
  const orchestrator = new MigrationOrchestrator(options)
  const result = await orchestrator.migrate()
  
  if (!result.success) {
    console.error('\n❌ Migration failed. Check the report for details.')
    process.exit(1)
  }
  
  console.log('\n✅ Migration completed successfully!')
  console.log(`📄 Full report: ${result.reportPath}`)
}

// Allow running as a script
if (require.main === module) {
  const args = process.argv.slice(2)
  const options: MigrationOptions = {}
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--workspace':
        options.workspaceRoot = args[++i]
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--no-backup':
        options.skipBackup = true
        break
      case '--no-compatibility':
        options.enableBackwardCompatibility = false
        break
      case '--migration-mode':
        const mode = args[++i] as 'strict' | 'permissive' | 'legacy'
        options.compatibilityConfig = { migrationMode: mode }
        break
      case '--help':
        console.log(`
OpenCode Migration Orchestrator

Usage: node migration-orchestrator.ts [options]

Options:
  --workspace <path>      Workspace root directory (default: current directory)
  --dry-run              Simulate migration without making changes
  --no-backup            Skip settings backup creation
  --no-compatibility     Disable backward compatibility layer
  --migration-mode <mode> Set migration mode: strict, permissive, legacy (default: permissive)
  --help                 Show this help message

Examples:
  node migration-orchestrator.ts
  node migration-orchestrator.ts --dry-run
  node migration-orchestrator.ts --workspace /path/to/project --migration-mode strict
`)
        process.exit(0)
        break
    }
  }
  
  runCompleteMigration(options).catch(error => {
    console.error('Migration orchestrator failed:', error)
    process.exit(1)
  })
}