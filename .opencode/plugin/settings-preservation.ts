/**
 * Settings Preservation Utility
 * 
 * This module handles preservation of user settings during migration
 * and provides utilities for maintaining user preferences across system changes.
 */

import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'
import { existsSync } from 'node:fs'

export interface UserSettings {
  // Obsidian plugin settings
  obsidianSettings?: {
    serverUrl?: string
    timeout?: number
    agent?: string
    model?: {
      providerID: string
      modelID: string
    }
    autoConnect?: boolean
  }
  
  // Claude Code settings
  claudeCodeSettings?: {
    hooks?: any
    preferences?: any
    shortcuts?: Record<string, string>
    commands?: Record<string, any>
  }
  
  // OpenCode settings
  openCodeSettings?: {
    agents?: Record<string, any>
    permissions?: Record<string, any>
    preferences?: any
  }
  
  // Migration metadata
  migrationInfo?: {
    originalVersion?: string
    migrationDate?: string
    preservedFeatures?: string[]
    customizations?: string[]
  }
}

export interface SettingsBackup {
  timestamp: string
  version: string
  settings: UserSettings
  files: Record<string, string> // filename -> content
}

export class SettingsPreservation {
  private workspaceRoot: string
  private backupDir: string

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot
    this.backupDir = join(workspaceRoot, '.opencode', 'settings-backup')
  }

  /**
   * Create a comprehensive backup of all user settings
   */
  async createSettingsBackup(): Promise<SettingsBackup> {
    await this.ensureBackupDirectory()
    
    const timestamp = new Date().toISOString()
    const version = await this.getProjectVersion()
    
    const backup: SettingsBackup = {
      timestamp,
      version,
      settings: await this.extractAllSettings(),
      files: await this.backupConfigFiles()
    }
    
    // Save backup to file
    const backupPath = join(this.backupDir, `settings-backup-${timestamp.replace(/[:.]/g, '-')}.json`)
    await fs.writeFile(backupPath, JSON.stringify(backup, null, 2))
    
    console.log(`✅ Settings backup created: ${backupPath}`)
    return backup
  }

  /**
   * Extract all user settings from various configuration files
   */
  private async extractAllSettings(): Promise<UserSettings> {
    const settings: UserSettings = {}

    // Extract Obsidian plugin settings
    settings.obsidianSettings = await this.extractObsidianSettings()
    
    // Extract Claude Code settings
    settings.claudeCodeSettings = await this.extractClaudeCodeSettings()
    
    // Extract OpenCode settings
    settings.openCodeSettings = await this.extractOpenCodeSettings()
    
    // Add migration metadata
    settings.migrationInfo = {
      originalVersion: await this.getProjectVersion(),
      migrationDate: new Date().toISOString(),
      preservedFeatures: await this.identifyPreservedFeatures(),
      customizations: await this.identifyCustomizations()
    }

    return settings
  }

  /**
   * Extract Obsidian plugin settings from data.json
   */
  private async extractObsidianSettings(): Promise<any> {
    try {
      // Look for Obsidian plugin data file
      const obsidianDir = join(this.workspaceRoot, '.obsidian')
      if (!existsSync(obsidianDir)) {
        return null
      }

      const pluginsDir = join(obsidianDir, 'plugins', 'claudesidian')
      const dataPath = join(pluginsDir, 'data.json')
      
      if (existsSync(dataPath)) {
        const content = await fs.readFile(dataPath, 'utf-8')
        return JSON.parse(content)
      }
    } catch (error) {
      console.warn('Failed to extract Obsidian settings:', error.message)
    }
    
    return null
  }

  /**
   * Extract Claude Code settings
   */
  private async extractClaudeCodeSettings(): Promise<any> {
    const settings: any = {}
    
    try {
      // Extract settings.json
      const settingsPath = join(this.workspaceRoot, '.claude', 'settings.json')
      if (existsSync(settingsPath)) {
        const content = await fs.readFile(settingsPath, 'utf-8')
        settings.hooks = JSON.parse(content)
      }

      // Extract claude_config.json
      const configPath = join(this.workspaceRoot, '.claude', 'claude_config.json')
      if (existsSync(configPath)) {
        const content = await fs.readFile(configPath, 'utf-8')
        const config = JSON.parse(content)
        settings.preferences = config.preferences
        settings.shortcuts = config.shortcuts
        settings.commands = config.commands
      }
    } catch (error) {
      console.warn('Failed to extract Claude Code settings:', error.message)
    }
    
    return Object.keys(settings).length > 0 ? settings : null
  }

  /**
   * Extract OpenCode settings
   */
  private async extractOpenCodeSettings(): Promise<any> {
    try {
      const configPath = join(this.workspaceRoot, 'opencode.jsonc')
      if (existsSync(configPath)) {
        const content = await fs.readFile(configPath, 'utf-8')
        // Remove comments for JSON parsing
        const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
        return JSON.parse(cleanContent)
      }
    } catch (error) {
      console.warn('Failed to extract OpenCode settings:', error.message)
    }
    
    return null
  }

  /**
   * Backup important configuration files
   */
  private async backupConfigFiles(): Promise<Record<string, string>> {
    const files: Record<string, string> = {}
    
    const filesToBackup = [
      '.claude/settings.json',
      '.claude/claude_config.json',
      'opencode.jsonc',
      'package.json',
      'manifest.json',
      '.obsidian/plugins/claudesidian/data.json'
    ]

    for (const filePath of filesToBackup) {
      const fullPath = join(this.workspaceRoot, filePath)
      if (existsSync(fullPath)) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8')
          files[filePath] = content
        } catch (error) {
          console.warn(`Failed to backup ${filePath}:`, error.message)
        }
      }
    }

    return files
  }

  /**
   * Identify features that should be preserved during migration
   */
  private async identifyPreservedFeatures(): Promise<string[]> {
    const features: string[] = []
    
    // Check for custom commands
    const commandsDir = join(this.workspaceRoot, '.claude', 'commands')
    if (existsSync(commandsDir)) {
      try {
        const commands = await fs.readdir(commandsDir)
        if (commands.length > 0) {
          features.push(`Custom commands (${commands.length} files)`)
        }
      } catch (error) {
        console.warn('Failed to check commands:', error.message)
      }
    }

    // Check for custom hooks
    const settingsPath = join(this.workspaceRoot, '.claude', 'settings.json')
    if (existsSync(settingsPath)) {
      try {
        const content = await fs.readFile(settingsPath, 'utf-8')
        const settings = JSON.parse(content)
        if (settings.hooks) {
          features.push('Custom hooks configuration')
        }
      } catch (error) {
        console.warn('Failed to check hooks:', error.message)
      }
    }

    // Check for custom shortcuts
    const configPath = join(this.workspaceRoot, '.claude', 'claude_config.json')
    if (existsSync(configPath)) {
      try {
        const content = await fs.readFile(configPath, 'utf-8')
        const config = JSON.parse(content)
        if (config.shortcuts && Object.keys(config.shortcuts).length > 0) {
          features.push(`Custom shortcuts (${Object.keys(config.shortcuts).length} shortcuts)`)
        }
      } catch (error) {
        console.warn('Failed to check shortcuts:', error.message)
      }
    }

    return features
  }

  /**
   * Identify user customizations
   */
  private async identifyCustomizations(): Promise<string[]> {
    const customizations: string[] = []
    
    // Check for modified default commands
    const commandsDir = join(this.workspaceRoot, '.claude', 'commands')
    if (existsSync(commandsDir)) {
      try {
        const commands = await fs.readdir(commandsDir)
        for (const command of commands) {
          if (command.endsWith('.md')) {
            const content = await fs.readFile(join(commandsDir, command), 'utf-8')
            // Simple heuristic: if file is longer than typical, it might be customized
            if (content.length > 2000) {
              customizations.push(`Modified command: ${command}`)
            }
          }
        }
      } catch (error) {
        console.warn('Failed to check command customizations:', error.message)
      }
    }

    // Check for custom agent configurations
    const openCodePath = join(this.workspaceRoot, 'opencode.jsonc')
    if (existsSync(openCodePath)) {
      try {
        const content = await fs.readFile(openCodePath, 'utf-8')
        if (content.includes('// Custom') || content.includes('/* Custom')) {
          customizations.push('Custom OpenCode configuration comments')
        }
      } catch (error) {
        console.warn('Failed to check OpenCode customizations:', error.message)
      }
    }

    return customizations
  }

  /**
   * Restore settings from backup
   */
  async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      const backupContent = await fs.readFile(backupPath, 'utf-8')
      const backup: SettingsBackup = JSON.parse(backupContent)
      
      console.log(`🔄 Restoring settings from backup: ${backup.timestamp}`)
      
      // Restore configuration files
      for (const [filePath, content] of Object.entries(backup.files)) {
        const fullPath = join(this.workspaceRoot, filePath)
        await fs.mkdir(dirname(fullPath), { recursive: true })
        await fs.writeFile(fullPath, content)
        console.log(`✅ Restored: ${filePath}`)
      }
      
      console.log('✅ Settings restoration completed')
    } catch (error) {
      throw new Error(`Failed to restore from backup: ${error.message}`)
    }
  }

  /**
   * Merge settings from backup with current settings
   */
  async mergeSettingsFromBackup(backupPath: string): Promise<void> {
    try {
      const backupContent = await fs.readFile(backupPath, 'utf-8')
      const backup: SettingsBackup = JSON.parse(backupContent)
      
      console.log(`🔄 Merging settings from backup: ${backup.timestamp}`)
      
      // Merge OpenCode configuration
      await this.mergeOpenCodeSettings(backup.settings)
      
      // Preserve user preferences
      await this.preserveUserPreferences(backup.settings)
      
      console.log('✅ Settings merge completed')
    } catch (error) {
      throw new Error(`Failed to merge settings from backup: ${error.message}`)
    }
  }

  /**
   * Merge OpenCode settings while preserving user customizations
   */
  private async mergeOpenCodeSettings(backupSettings: UserSettings): Promise<void> {
    const configPath = join(this.workspaceRoot, 'opencode.jsonc')
    
    if (!backupSettings.openCodeSettings) {
      return
    }

    let currentConfig: any = {}
    
    // Load current config if it exists
    if (existsSync(configPath)) {
      const content = await fs.readFile(configPath, 'utf-8')
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      currentConfig = JSON.parse(cleanContent)
    }

    // Merge settings (current takes precedence over backup for conflicts)
    const mergedConfig = {
      ...backupSettings.openCodeSettings,
      ...currentConfig,
      // Merge agent configurations
      agent: {
        ...backupSettings.openCodeSettings.agents,
        ...currentConfig.agent
      },
      // Merge permissions
      permission: {
        ...backupSettings.openCodeSettings.permissions,
        ...currentConfig.permission
      }
    }

    // Write merged configuration
    await fs.writeFile(configPath, JSON.stringify(mergedConfig, null, 2))
  }

  /**
   * Preserve user preferences in a separate file
   */
  private async preserveUserPreferences(backupSettings: UserSettings): Promise<void> {
    const preferencesPath = join(this.workspaceRoot, '.opencode', 'user-preferences.json')
    await fs.mkdir(dirname(preferencesPath), { recursive: true })
    
    const preferences = {
      preservedFrom: 'settings-backup',
      preservationDate: new Date().toISOString(),
      originalSettings: {
        claudeCode: backupSettings.claudeCodeSettings,
        obsidian: backupSettings.obsidianSettings
      },
      migrationInfo: backupSettings.migrationInfo
    }

    await fs.writeFile(preferencesPath, JSON.stringify(preferences, null, 2))
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<Array<{ path: string; timestamp: string; version: string }>> {
    const backups: Array<{ path: string; timestamp: string; version: string }> = []
    
    if (!existsSync(this.backupDir)) {
      return backups
    }

    try {
      const files = await fs.readdir(this.backupDir)
      
      for (const file of files) {
        if (file.startsWith('settings-backup-') && file.endsWith('.json')) {
          const filePath = join(this.backupDir, file)
          try {
            const content = await fs.readFile(filePath, 'utf-8')
            const backup: SettingsBackup = JSON.parse(content)
            
            backups.push({
              path: filePath,
              timestamp: backup.timestamp,
              version: backup.version
            })
          } catch (error) {
            console.warn(`Failed to read backup ${file}:`, error.message)
          }
        }
      }
    } catch (error) {
      console.warn('Failed to list backups:', error.message)
    }

    return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  }

  /**
   * Get project version from package.json
   */
  private async getProjectVersion(): Promise<string> {
    try {
      const packagePath = join(this.workspaceRoot, 'package.json')
      if (existsSync(packagePath)) {
        const content = await fs.readFile(packagePath, 'utf-8')
        const packageJson = JSON.parse(content)
        return packageJson.version || 'unknown'
      }
    } catch (error) {
      console.warn('Failed to get project version:', error.message)
    }
    
    return 'unknown'
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirectory(): Promise<void> {
    if (!existsSync(this.backupDir)) {
      await fs.mkdir(this.backupDir, { recursive: true })
    }
  }
}

/**
 * CLI interface for settings preservation
 */
export async function preserveSettings(workspaceRoot: string = process.cwd()): Promise<void> {
  console.log('💾 Creating settings backup...')
  
  const preservation = new SettingsPreservation(workspaceRoot)
  const backup = await preservation.createSettingsBackup()
  
  console.log('\n' + '='.repeat(50))
  console.log('SETTINGS BACKUP SUMMARY')
  console.log('='.repeat(50))
  console.log(`Timestamp: ${backup.timestamp}`)
  console.log(`Version: ${backup.version}`)
  console.log(`Files backed up: ${Object.keys(backup.files).length}`)
  console.log(`Preserved features: ${backup.settings.migrationInfo?.preservedFeatures?.length || 0}`)
  console.log(`Customizations: ${backup.settings.migrationInfo?.customizations?.length || 0}`)
  
  if (backup.settings.migrationInfo?.preservedFeatures?.length) {
    console.log('\nPreserved features:')
    backup.settings.migrationInfo.preservedFeatures.forEach(feature => {
      console.log(`  ✅ ${feature}`)
    })
  }
  
  if (backup.settings.migrationInfo?.customizations?.length) {
    console.log('\nCustomizations:')
    backup.settings.migrationInfo.customizations.forEach(customization => {
      console.log(`  🔧 ${customization}`)
    })
  }
}

// Allow running as a script
if (require.main === module) {
  const command = process.argv[2]
  const workspaceRoot = process.argv[3] || process.cwd()
  
  if (command === 'backup') {
    preserveSettings(workspaceRoot).catch(error => {
      console.error('Settings preservation failed:', error)
      process.exit(1)
    })
  } else if (command === 'list') {
    const preservation = new SettingsPreservation(workspaceRoot)
    preservation.listBackups().then(backups => {
      console.log('Available backups:')
      backups.forEach(backup => {
        console.log(`  ${backup.timestamp} (v${backup.version}) - ${backup.path}`)
      })
    }).catch(error => {
      console.error('Failed to list backups:', error)
      process.exit(1)
    })
  } else {
    console.log('Usage: node settings-preservation.ts <backup|list> [workspace-root]')
    process.exit(1)
  }
}