/**
 * Migration Utilities for OpenCode Migration
 * 
 * This module provides utilities for migrating from Claude Code to OpenCode,
 * including configuration migration and settings preservation.
 */

import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'
import { existsSync } from 'node:fs'

export interface ClaudeCodeSettings {
  hooks?: {
    SessionStart?: Array<{
      hooks: Array<{
        type: string
        command: string
      }>
    }>
  }
}

export interface ClaudeCodeConfig {
  name?: string
  description?: string
  version?: string
  settings?: {
    default_mode?: string
    auto_save?: boolean
    context_awareness?: boolean
  }
  commands?: Record<string, {
    description: string
    file: string
  }>
  shortcuts?: Record<string, string>
  preferences?: {
    primary_folders?: string[]
    template_folder?: string
    archive_after_days?: number
    default_note_location?: string
  }
}

export interface OpenCodeConfig {
  agent?: Record<string, {
    description: string
    permission: Record<string, any>
    options: Record<string, any>
  }>
  permission?: Record<string, any>
  $schema?: string
}

export interface MigrationResult {
  success: boolean
  migratedFiles: string[]
  warnings: string[]
  errors: string[]
  backupPath?: string
}

export class MigrationUtilities {
  private workspaceRoot: string
  private backupDir: string

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot
    this.backupDir = join(workspaceRoot, '.opencode', 'migration-backup')
  }

  /**
   * Main migration function that orchestrates the entire migration process
   */
  async migrate(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedFiles: [],
      warnings: [],
      errors: []
    }

    try {
      // Create backup directory
      await this.ensureBackupDirectory()
      result.backupPath = this.backupDir

      // Step 1: Backup existing configurations
      await this.backupExistingConfigurations(result)

      // Step 2: Migrate Claude Code settings to OpenCode
      await this.migrateClaudeCodeSettings(result)

      // Step 3: Migrate commands
      await this.migrateCommands(result)

      // Step 4: Migrate hooks to plugins
      await this.migrateHooksToPlugins(result)

      // Step 5: Create OpenCode configuration
      await this.createOpenCodeConfiguration(result)

      // Step 6: Preserve user preferences
      await this.preserveUserPreferences(result)

      result.success = result.errors.length === 0
      
      if (result.success) {
        console.log('✅ Migration completed successfully')
      } else {
        console.log('❌ Migration completed with errors')
      }

      return result

    } catch (error) {
      result.errors.push(`Migration failed: ${error.message}`)
      result.success = false
      return result
    }
  }

  /**
   * Create backup directory if it doesn't exist
   */
  private async ensureBackupDirectory(): Promise<void> {
    if (!existsSync(this.backupDir)) {
      await fs.mkdir(this.backupDir, { recursive: true })
    }
  }

  /**
   * Backup existing configurations before migration
   */
  private async backupExistingConfigurations(result: MigrationResult): Promise<void> {
    const filesToBackup = [
      '.claude/settings.json',
      '.claude/claude_config.json',
      'opencode.jsonc'
    ]

    for (const file of filesToBackup) {
      const sourcePath = join(this.workspaceRoot, file)
      if (existsSync(sourcePath)) {
        try {
          const backupPath = join(this.backupDir, file.replace('/', '_'))
          await fs.mkdir(dirname(backupPath), { recursive: true })
          await fs.copyFile(sourcePath, backupPath)
          result.migratedFiles.push(`Backed up: ${file}`)
        } catch (error) {
          result.warnings.push(`Failed to backup ${file}: ${error.message}`)
        }
      }
    }
  }

  /**
   * Migrate Claude Code settings.json to OpenCode format
   */
  private async migrateClaudeCodeSettings(result: MigrationResult): Promise<void> {
    const settingsPath = join(this.workspaceRoot, '.claude', 'settings.json')
    
    if (!existsSync(settingsPath)) {
      result.warnings.push('No Claude Code settings.json found to migrate')
      return
    }

    try {
      const settingsContent = await fs.readFile(settingsPath, 'utf-8')
      const settings: ClaudeCodeSettings = JSON.parse(settingsContent)

      // Extract session start hooks and convert to OpenCode plugins
      if (settings.hooks?.SessionStart) {
        const sessionHooks = settings.hooks.SessionStart
        await this.convertSessionHooksToPlugin(sessionHooks, result)
      }

      result.migratedFiles.push('Migrated Claude Code settings.json')
    } catch (error) {
      result.errors.push(`Failed to migrate Claude Code settings: ${error.message}`)
    }
  }

  /**
   * Convert Claude Code session hooks to OpenCode plugin
   */
  private async convertSessionHooksToPlugin(
    sessionHooks: Array<{ hooks: Array<{ type: string; command: string }> }>,
    result: MigrationResult
  ): Promise<void> {
    const pluginContent = `/**
 * Session Hooks Plugin - Migrated from Claude Code
 * 
 * This plugin replicates the session start hooks from Claude Code settings.
 */

import type { Plugin } from '@opencode-ai/core'

export default function sessionHooks(): Plugin {
  return {
    name: 'session-hooks',
    on: {
      'session.created': async ({ $ }) => {
        // Migrated session start hooks
${sessionHooks.map(hookGroup => 
  hookGroup.hooks.map(hook => 
    `        // ${hook.type}: ${hook.command}
        try {
          await $\`${hook.command.replace(/'/g, "\\'")}\`
        } catch (error) {
          console.warn('Session hook failed:', error.message)
        }`
  ).join('\n')
).join('\n')}
      }
    }
  }
}
`

    const pluginPath = join(this.workspaceRoot, '.opencode', 'plugin', 'session-hooks.ts')
    await fs.mkdir(dirname(pluginPath), { recursive: true })
    await fs.writeFile(pluginPath, pluginContent)
    
    result.migratedFiles.push('Created session-hooks.ts plugin from Claude Code hooks')
  }

  /**
   * Migrate commands from .claude/commands to .opencode/command
   */
  private async migrateCommands(result: MigrationResult): Promise<void> {
    const claudeCommandsDir = join(this.workspaceRoot, '.claude', 'commands')
    const openCodeCommandsDir = join(this.workspaceRoot, '.opencode', 'command')

    if (!existsSync(claudeCommandsDir)) {
      result.warnings.push('No Claude Code commands directory found')
      return
    }

    try {
      await fs.mkdir(openCodeCommandsDir, { recursive: true })
      const commandFiles = await fs.readdir(claudeCommandsDir)

      for (const file of commandFiles) {
        if (file.endsWith('.md')) {
          await this.migrateCommandFile(
            join(claudeCommandsDir, file),
            join(openCodeCommandsDir, file),
            result
          )
        }
      }
    } catch (error) {
      result.errors.push(`Failed to migrate commands: ${error.message}`)
    }
  }

  /**
   * Migrate individual command file and add OpenCode frontmatter
   */
  private async migrateCommandFile(
    sourcePath: string,
    targetPath: string,
    result: MigrationResult
  ): Promise<void> {
    try {
      const content = await fs.readFile(sourcePath, 'utf-8')
      
      // Check if file already has frontmatter
      if (content.startsWith('---')) {
        // File already has frontmatter, just copy it
        await fs.copyFile(sourcePath, targetPath)
        result.migratedFiles.push(`Copied command: ${sourcePath}`)
        return
      }

      // Add OpenCode frontmatter based on command name and content analysis
      const commandName = sourcePath.split('/').pop()?.replace('.md', '') || 'unknown'
      const agentMapping = await this.getAgentForCommand(commandName, content)
      
      const frontmatter = `---
agent: ${agentMapping.agent}
description: ${agentMapping.description}
---

`

      const migratedContent = frontmatter + content
      await fs.writeFile(targetPath, migratedContent)
      
      result.migratedFiles.push(`Migrated command: ${commandName} (agent: ${agentMapping.agent})`)
    } catch (error) {
      result.errors.push(`Failed to migrate command ${sourcePath}: ${error.message}`)
    }
  }

  /**
   * Get appropriate agent mapping for command by analyzing content
   */
  private async getAgentForCommand(
    commandName: string, 
    commandContent?: string
  ): Promise<{ agent: string; description: string }> {
    // First check for known command patterns
    const knownMappings: Record<string, { agent: string; description: string }> = {
      'init-bootstrap': { agent: 'bootstrap', description: 'Initialize and bootstrap the vault setup' },
      'thinking-partner': { agent: 'thinking-partner', description: 'Collaborative thinking and exploration' },
      'research-assistant': { agent: 'research-assistant', description: 'Deep research and information gathering' }
    }

    if (knownMappings[commandName]) {
      return knownMappings[commandName]
    }

    // If we have command content, analyze it to determine the best agent
    if (commandContent) {
      return this.analyzeCommandContent(commandName, commandContent)
    }

    // Default fallback
    return { agent: 'assistant', description: `Command: ${commandName}` }
  }

  /**
   * Analyze command content to determine appropriate agent and description
   */
  private analyzeCommandContent(commandName: string, content: string): { agent: string; description: string } {
    const lowerContent = content.toLowerCase()
    
    // Extract description from content (look for description patterns)
    let description = `Command: ${commandName}`
    
    // Try to extract description from various patterns
    const descriptionPatterns = [
      /description[:\s]+([^\n]+)/i,
      /^#\s+(.+)$/m,
      /^##\s+(.+)$/m,
      /purpose[:\s]+([^\n]+)/i,
      /this command[:\s]+([^\n]+)/i
    ]
    
    for (const pattern of descriptionPatterns) {
      const match = content.match(pattern)
      if (match && match[1]) {
        description = match[1].trim()
        break
      }
    }

    // Analyze content to determine agent type
    const analysisRules = [
      {
        agent: 'bootstrap',
        keywords: ['install', 'setup', 'initialize', 'bootstrap', 'git', 'npm', 'pnpm', 'upgrade', 'release', 'deploy', 'build', 'configure'],
        description: 'System setup and configuration command'
      },
      {
        agent: 'thinking-partner', 
        keywords: ['think', 'explore', 'brainstorm', 'analyze', 'reflect', 'consider', 'ponder', 'examine'],
        description: 'Collaborative thinking and exploration command'
      },
      {
        agent: 'research-assistant',
        keywords: ['research', 'search', 'find', 'gather', 'collect', 'investigate', 'study', 'web', 'fetch', 'crawl'],
        description: 'Research and information gathering command'
      },
      {
        agent: 'read-only',
        keywords: ['read', 'view', 'display', 'show', 'list', 'check', 'status', 'review', 'audit'],
        description: 'Read-only analysis and review command'
      }
    ]

    // Score each agent based on keyword matches
    let bestMatch = { agent: 'assistant', score: 0, description }
    
    for (const rule of analysisRules) {
      let score = 0
      for (const keyword of rule.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
        const matches = content.match(regex)
        if (matches) {
          score += matches.length
        }
      }
      
      if (score > bestMatch.score) {
        bestMatch = {
          agent: rule.agent,
          score,
          description: description.includes('Command:') ? rule.description : description
        }
      }
    }

    // Additional analysis for permission requirements
    const hasFileOperations = /write|create|delete|modify|edit|save/i.test(content)
    const hasBashCommands = /bash|shell|command|execute|run/i.test(content)
    const hasWebAccess = /http|url|web|fetch|download|api/i.test(content)

    // Adjust agent based on permission requirements
    if (bestMatch.agent === 'assistant') {
      if (hasBashCommands && (hasFileOperations || /system|install|setup/i.test(content))) {
        bestMatch.agent = 'bootstrap'
        bestMatch.description = 'System operation command requiring elevated permissions'
      } else if (hasWebAccess && !hasFileOperations) {
        bestMatch.agent = 'research-assistant'
        bestMatch.description = 'Research command with web access requirements'
      } else if (!hasFileOperations && !hasBashCommands) {
        bestMatch.agent = 'read-only'
        bestMatch.description = 'Analysis command with read-only access'
      }
    }

    return {
      agent: bestMatch.agent,
      description: bestMatch.description
    }
  }

  /**
   * Migrate hooks to OpenCode plugins
   */
  private async migrateHooksToPlugins(result: MigrationResult): Promise<void> {
    // This is handled in migrateClaudeCodeSettings for session hooks
    // Additional hook types can be added here as needed
    result.migratedFiles.push('Hook migration completed (session hooks converted to plugin)')
  }

  /**
   * Create or update OpenCode configuration
   */
  private async createOpenCodeConfiguration(result: MigrationResult): Promise<void> {
    const configPath = join(this.workspaceRoot, 'opencode.jsonc')
    
    try {
      let existingConfig: OpenCodeConfig = {}
      
      // Load existing config if it exists
      if (existsSync(configPath)) {
        const existingContent = await fs.readFile(configPath, 'utf-8')
        // Remove comments for JSON parsing
        const cleanContent = existingContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
        existingConfig = JSON.parse(cleanContent)
      }

      // Load Claude Code config for migration
      const claudeConfigPath = join(this.workspaceRoot, '.claude', 'claude_config.json')
      let claudeConfig: ClaudeCodeConfig = {}
      
      if (existsSync(claudeConfigPath)) {
        const claudeContent = await fs.readFile(claudeConfigPath, 'utf-8')
        claudeConfig = JSON.parse(claudeContent)
      }

      // Merge configurations
      const migratedConfig = this.mergeConfigurations(existingConfig, claudeConfig)
      
      // Write updated configuration
      const configContent = JSON.stringify(migratedConfig, null, 2)
      await fs.writeFile(configPath, configContent)
      
      result.migratedFiles.push('Created/updated opencode.jsonc configuration')
    } catch (error) {
      result.errors.push(`Failed to create OpenCode configuration: ${error.message}`)
    }
  }

  /**
   * Merge existing OpenCode config with migrated Claude Code settings
   */
  private mergeConfigurations(existingConfig: OpenCodeConfig, claudeConfig: ClaudeCodeConfig): OpenCodeConfig {
    const merged: OpenCodeConfig = {
      ...existingConfig,
      $schema: 'https://opencode.ai/config.json'
    }

    // Ensure agent configurations exist
    if (!merged.agent) {
      merged.agent = {}
    }

    // Add default agent configurations if they don't exist
    const defaultAgents = {
      bootstrap: {
        description: 'Full-access bootstrap agent for setup, initialization, git operations',
        permission: {
          bash: { '*': 'allow' },
          edit: 'allow',
          glob: 'allow',
          grep: 'allow',
          multiedit: 'allow',
          read: 'allow',
          task: 'allow',
          webfetch: 'allow',
          write: 'allow'
        },
        options: {}
      },
      'thinking-partner': {
        description: 'Read-only thinking assistant for collaborative exploration',
        permission: {
          bash: { '*': 'deny' },
          edit: 'deny',
          glob: 'allow',
          multiedit: 'deny',
          read: 'allow',
          webfetch: 'deny',
          write: 'deny'
        },
        options: {}
      },
      'research-assistant': {
        description: 'Research agent for information gathering and web research',
        permission: {
          bash: {
            'ls *': 'allow',
            'cat *': 'allow',
            'curl *': 'allow',
            'wget *': 'allow',
            '*': 'ask'
          },
          edit: 'allow',
          glob: 'allow',
          read: 'allow',
          webfetch: 'ask',
          write: 'allow'
        },
        options: {}
      },
      assistant: {
        description: 'Standard assistant for daily tasks and file operations',
        permission: {
          bash: { '*': 'ask' },
          edit: 'allow',
          glob: 'allow',
          read: 'allow',
          webfetch: 'ask',
          write: 'allow'
        },
        options: {}
      }
    }

    // Add missing default agents
    for (const [agentName, agentConfig] of Object.entries(defaultAgents)) {
      if (!merged.agent[agentName]) {
        merged.agent[agentName] = agentConfig
      }
    }

    // Ensure permission configuration exists
    if (!merged.permission) {
      merged.permission = {
        '*': 'ask',
        bash: {
          '*': 'ask',
          'git status': 'allow',
          'git diff': 'allow',
          'git log': 'allow',
          'ls': 'allow',
          'cat': 'allow',
          'pwd': 'allow',
          'echo': 'allow'
        },
        edit: {
          '*.md': 'allow',
          '*.json': 'allow',
          '*.ts': 'allow',
          '*.js': 'allow'
        },
        glob: 'allow',
        grep: 'allow',
        read: 'allow',
        webfetch: 'ask',
        write: 'ask'
      }
    }

    return merged
  }

  /**
   * Preserve user preferences and settings
   */
  private async preserveUserPreferences(result: MigrationResult): Promise<void> {
    try {
      // Load Claude Code preferences
      const claudeConfigPath = join(this.workspaceRoot, '.claude', 'claude_config.json')
      
      if (!existsSync(claudeConfigPath)) {
        result.warnings.push('No Claude Code config found for preference migration')
        return
      }

      const claudeContent = await fs.readFile(claudeConfigPath, 'utf-8')
      const claudeConfig: ClaudeCodeConfig = JSON.parse(claudeContent)

      if (claudeConfig.preferences) {
        // Create a preferences file for OpenCode
        const preferencesPath = join(this.workspaceRoot, '.opencode', 'preferences.json')
        await fs.mkdir(dirname(preferencesPath), { recursive: true })
        
        const preferences = {
          migratedFrom: 'claude-code',
          migrationDate: new Date().toISOString(),
          originalPreferences: claudeConfig.preferences,
          shortcuts: claudeConfig.shortcuts || {},
          settings: claudeConfig.settings || {}
        }

        await fs.writeFile(preferencesPath, JSON.stringify(preferences, null, 2))
        result.migratedFiles.push('Preserved user preferences in .opencode/preferences.json')
      }

      // Preserve command shortcuts as comments in opencode.jsonc
      if (claudeConfig.shortcuts) {
        const configPath = join(this.workspaceRoot, 'opencode.jsonc')
        if (existsSync(configPath)) {
          let content = await fs.readFile(configPath, 'utf-8')
          
          const shortcutsComment = `
/*
 * Migrated Command Shortcuts from Claude Code:
${Object.entries(claudeConfig.shortcuts).map(([short, full]) => 
  ` * ${short} -> ${full}`
).join('\n')}
 */
`
          
          // Insert shortcuts comment after the opening brace
          content = content.replace('{', '{' + shortcutsComment)
          await fs.writeFile(configPath, content)
          
          result.migratedFiles.push('Added command shortcuts as comments to opencode.jsonc')
        }
      }

    } catch (error) {
      result.errors.push(`Failed to preserve user preferences: ${error.message}`)
    }
  }

  /**
   * Validate migration results
   */
  async validateMigration(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = []

    // Check if OpenCode config exists
    const configPath = join(this.workspaceRoot, 'opencode.jsonc')
    if (!existsSync(configPath)) {
      issues.push('OpenCode configuration file (opencode.jsonc) not found')
    }

    // Check if commands were migrated
    const commandsDir = join(this.workspaceRoot, '.opencode', 'command')
    if (!existsSync(commandsDir)) {
      issues.push('OpenCode commands directory not found')
    } else {
      try {
        const files = await fs.readdir(commandsDir)
        if (files.length === 0) {
          issues.push('No commands found in OpenCode commands directory')
        }
      } catch (error) {
        issues.push(`Failed to read commands directory: ${error.message}`)
      }
    }

    // Check if plugins directory exists
    const pluginsDir = join(this.workspaceRoot, '.opencode', 'plugin')
    if (!existsSync(pluginsDir)) {
      issues.push('OpenCode plugins directory not found')
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * Generate migration report
   */
  generateMigrationReport(result: MigrationResult): string {
    const report = `# OpenCode Migration Report

**Migration Date:** ${new Date().toISOString()}
**Status:** ${result.success ? '✅ SUCCESS' : '❌ FAILED'}
**Backup Location:** ${result.backupPath || 'N/A'}

## Migrated Files
${result.migratedFiles.map(file => `- ✅ ${file}`).join('\n')}

## Warnings
${result.warnings.length > 0 ? result.warnings.map(warning => `- ⚠️ ${warning}`).join('\n') : '- None'}

## Errors
${result.errors.length > 0 ? result.errors.map(error => `- ❌ ${error}`).join('\n') : '- None'}

## Next Steps

${result.success ? `
1. Review the migrated configuration in \`opencode.jsonc\`
2. Test commands in the \`.opencode/command/\` directory
3. Verify plugins in the \`.opencode/plugin/\` directory
4. Remove Claude Code files if migration is successful:
   - \`.claude/settings.json\`
   - \`.claude/claude_config.json\`
   - \`.claude/commands/\` (after verifying OpenCode commands work)
` : `
1. Review and fix the errors listed above
2. Re-run the migration process
3. Check the backup files in ${result.backupPath}
`}

## Migration Validation

Run the following command to validate the migration:
\`\`\`bash
node -e "
const { MigrationUtilities } = require('./.opencode/plugin/migration-utilities.ts');
const migration = new MigrationUtilities(process.cwd());
migration.validateMigration().then(result => {
  console.log('Validation:', result.valid ? 'PASSED' : 'FAILED');
  if (result.issues.length > 0) {
    console.log('Issues:', result.issues);
  }
});
"
\`\`\`
`

    return report
  }
}

/**
 * CLI interface for running migration
 */
export async function runMigration(workspaceRoot: string = process.cwd()): Promise<void> {
  console.log('🚀 Starting OpenCode migration...')
  
  const migration = new MigrationUtilities(workspaceRoot)
  const result = await migration.migrate()
  
  // Generate and save migration report
  const report = migration.generateMigrationReport(result)
  const reportPath = join(workspaceRoot, '.opencode', 'migration-report.md')
  
  try {
    await fs.writeFile(reportPath, report)
    console.log(`📄 Migration report saved to: ${reportPath}`)
  } catch (error) {
    console.error('Failed to save migration report:', error.message)
  }
  
  // Print summary
  console.log('\n' + '='.repeat(50))
  console.log('MIGRATION SUMMARY')
  console.log('='.repeat(50))
  console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`)
  console.log(`Files migrated: ${result.migratedFiles.length}`)
  console.log(`Warnings: ${result.warnings.length}`)
  console.log(`Errors: ${result.errors.length}`)
  
  if (result.errors.length > 0) {
    console.log('\nErrors:')
    result.errors.forEach(error => console.log(`  ❌ ${error}`))
  }
  
  if (result.warnings.length > 0) {
    console.log('\nWarnings:')
    result.warnings.forEach(warning => console.log(`  ⚠️ ${warning}`))
  }
  
  console.log(`\nBackup location: ${result.backupPath}`)
  console.log(`Report location: ${reportPath}`)
  
  process.exit(result.success ? 0 : 1)
}

// Allow running as a script
if (require.main === module) {
  runMigration().catch(error => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
}