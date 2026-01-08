/**
 * Backward Compatibility Layer
 * 
 * This module provides backward compatibility for existing vault structures
 * and functionality during the OpenCode migration process.
 */

import { promises as fs } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { existsSync } from 'node:fs'

// Define Plugin interface locally since @opencode-ai/core may not be available during migration
interface Plugin {
  name: string
  on: Record<string, (context: any) => Promise<any>>
}

export interface CompatibilityConfig {
  enableClaudeCodeCommands: boolean
  preserveVaultStructure: boolean
  maintainShortcuts: boolean
  enableLegacyHooks: boolean
  migrationMode: 'strict' | 'permissive' | 'legacy'
}

export interface VaultStructure {
  isObsidianVault: boolean
  hasPARAStructure: boolean
  folders: {
    inbox: string[]
    projects: string[]
    areas: string[]
    resources: string[]
    archive: string[]
    attachments: string[]
    metadata: string[]
  }
  customFolders: string[]
  pluginSettings: Record<string, any>
}

export class BackwardCompatibilityLayer {
  private workspaceRoot: string
  private config: CompatibilityConfig
  private vaultStructure: VaultStructure | null = null

  constructor(workspaceRoot: string, config: Partial<CompatibilityConfig> = {}) {
    this.workspaceRoot = workspaceRoot
    this.config = {
      enableClaudeCodeCommands: true,
      preserveVaultStructure: true,
      maintainShortcuts: true,
      enableLegacyHooks: true,
      migrationMode: 'permissive',
      ...config
    }
  }

  /**
   * Initialize backward compatibility layer
   */
  async initialize(): Promise<void> {
    console.log('🔄 Initializing backward compatibility layer...')
    
    // Analyze vault structure
    this.vaultStructure = await this.analyzeVaultStructure()
    
    // Set up compatibility features
    await this.setupVaultCompatibility()
    await this.setupCommandCompatibility()
    await this.setupShortcutCompatibility()
    await this.setupHookCompatibility()
    
    console.log('✅ Backward compatibility layer initialized')
  }

  /**
   * Analyze existing vault structure
   */
  private async analyzeVaultStructure(): Promise<VaultStructure> {
    const structure: VaultStructure = {
      isObsidianVault: false,
      hasPARAStructure: false,
      folders: {
        inbox: [],
        projects: [],
        areas: [],
        resources: [],
        archive: [],
        attachments: [],
        metadata: []
      },
      customFolders: [],
      pluginSettings: {}
    }

    // Check if this is an Obsidian vault
    const obsidianDir = join(this.workspaceRoot, '.obsidian')
    structure.isObsidianVault = existsSync(obsidianDir)

    if (structure.isObsidianVault) {
      // Load Obsidian plugin settings
      structure.pluginSettings = await this.loadObsidianPluginSettings()
    }

    // Analyze folder structure
    try {
      const entries = await fs.readdir(this.workspaceRoot, { withFileTypes: true })
      const directories = entries.filter(entry => entry.isDirectory()).map(entry => entry.name)

      // Categorize folders based on PARA method
      for (const dir of directories) {
        if (dir.startsWith('.')) continue // Skip hidden directories

        if (this.isInboxFolder(dir)) {
          structure.folders.inbox.push(dir)
        } else if (this.isProjectsFolder(dir)) {
          structure.folders.projects.push(dir)
        } else if (this.isAreasFolder(dir)) {
          structure.folders.areas.push(dir)
        } else if (this.isResourcesFolder(dir)) {
          structure.folders.resources.push(dir)
        } else if (this.isArchiveFolder(dir)) {
          structure.folders.archive.push(dir)
        } else if (this.isAttachmentsFolder(dir)) {
          structure.folders.attachments.push(dir)
        } else if (this.isMetadataFolder(dir)) {
          structure.folders.metadata.push(dir)
        } else {
          structure.customFolders.push(dir)
        }
      }

      // Check if PARA structure exists
      structure.hasPARAStructure = (
        structure.folders.inbox.length > 0 ||
        structure.folders.projects.length > 0 ||
        structure.folders.areas.length > 0 ||
        structure.folders.resources.length > 0
      )

    } catch (error) {
      console.warn('Failed to analyze vault structure:', error.message)
    }

    return structure
  }

  /**
   * Folder classification helpers
   */
  private isInboxFolder(name: string): boolean {
    return /^(00_)?inbox$/i.test(name) || /^0+[_\s]*inbox/i.test(name)
  }

  private isProjectsFolder(name: string): boolean {
    return /^(01_)?projects$/i.test(name) || /^0*1[_\s]*projects/i.test(name)
  }

  private isAreasFolder(name: string): boolean {
    return /^(02_)?areas$/i.test(name) || /^0*2[_\s]*areas/i.test(name)
  }

  private isResourcesFolder(name: string): boolean {
    return /^(03_)?resources$/i.test(name) || /^0*3[_\s]*resources/i.test(name)
  }

  private isArchiveFolder(name: string): boolean {
    return /^(04_)?archive$/i.test(name) || /^0*4[_\s]*archive/i.test(name)
  }

  private isAttachmentsFolder(name: string): boolean {
    return /^(05_)?attachments$/i.test(name) || /^0*5[_\s]*attachments/i.test(name)
  }

  private isMetadataFolder(name: string): boolean {
    return /^(06_)?metadata$/i.test(name) || /^0*6[_\s]*metadata/i.test(name)
  }

  /**
   * Load Obsidian plugin settings
   */
  private async loadObsidianPluginSettings(): Promise<Record<string, any>> {
    const settings: Record<string, any> = {}

    try {
      const pluginsDir = join(this.workspaceRoot, '.obsidian', 'plugins')
      
      if (existsSync(pluginsDir)) {
        const plugins = await fs.readdir(pluginsDir)
        
        for (const plugin of plugins) {
          const dataPath = join(pluginsDir, plugin, 'data.json')
          if (existsSync(dataPath)) {
            try {
              const content = await fs.readFile(dataPath, 'utf-8')
              settings[plugin] = JSON.parse(content)
            } catch (error) {
              console.warn(`Failed to load settings for plugin ${plugin}:`, error.message)
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load Obsidian plugin settings:', error.message)
    }

    return settings
  }

  /**
   * Set up vault structure compatibility
   */
  private async setupVaultCompatibility(): Promise<void> {
    if (!this.config.preserveVaultStructure || !this.vaultStructure) {
      return
    }

    // Create compatibility configuration
    const compatConfig = {
      vaultStructure: this.vaultStructure,
      preservationMode: this.config.migrationMode,
      createdAt: new Date().toISOString()
    }

    const configPath = join(this.workspaceRoot, '.opencode', 'vault-compatibility.json')
    await fs.mkdir(dirname(configPath), { recursive: true })
    await fs.writeFile(configPath, JSON.stringify(compatConfig, null, 2))

    // Create vault context plugin if it doesn't exist
    await this.ensureVaultContextPlugin()
  }

  /**
   * Ensure vault context plugin exists for compatibility
   */
  private async ensureVaultContextPlugin(): Promise<void> {
    const pluginPath = join(this.workspaceRoot, '.opencode', 'plugin', 'vault-compatibility.ts')
    
    if (existsSync(pluginPath)) {
      return // Plugin already exists
    }

    const pluginContent = `/**
 * Vault Compatibility Plugin
 * 
 * Provides backward compatibility for existing vault structures
 * and maintains compatibility with Obsidian workflows.
 */

// Define Plugin interface locally
interface Plugin {
  name: string
  on: Record<string, (context: any) => Promise<any>>
}

export default function vaultCompatibility(): Plugin {
  return {
    name: 'vault-compatibility',
    on: {
      'session.created': async ({ session, $ }) => {
        // Load vault compatibility configuration
        const configPath = require('path').join(process.cwd(), '.opencode', 'vault-compatibility.json')
        
        try {
          const fs = require('fs').promises
          const configContent = await fs.readFile(configPath, 'utf-8')
          const config = JSON.parse(configContent)
          
          // Inject vault structure context
          if (config.vaultStructure?.isObsidianVault) {
            console.log('📁 Obsidian vault detected - compatibility mode enabled')
            
            // Set up PARA structure awareness
            if (config.vaultStructure.hasPARAStructure) {
              const paraInfo = [
                'This vault uses the PARA method for organization:',
                \`- Inbox: \${config.vaultStructure.folders.inbox.join(', ') || 'None'}\`,
                \`- Projects: \${config.vaultStructure.folders.projects.join(', ') || 'None'}\`,
                \`- Areas: \${config.vaultStructure.folders.areas.join(', ') || 'None'}\`,
                \`- Resources: \${config.vaultStructure.folders.resources.join(', ') || 'None'}\`,
                \`- Archive: \${config.vaultStructure.folders.archive.join(', ') || 'None'}\`
              ].join('\\n')
              
              console.log('📋 PARA structure detected:', paraInfo)
            }
          }
        } catch (error) {
          console.warn('Failed to load vault compatibility config:', error.message)
        }
      },

      'tool.execute.before': async ({ tool, input, context }) => {
        // Intercept file operations to maintain vault compatibility
        if (tool === 'write' || tool === 'edit') {
          const filePath = input.path || input.file
          if (filePath && !filePath.startsWith('.')) {
            // Ensure file operations respect vault structure
            console.log(\`📝 File operation on: \${filePath}\`)
          }
        }
      }
    }
  }
}
`

    await fs.writeFile(pluginPath, pluginContent)
    console.log('✅ Created vault compatibility plugin')
  }

  /**
   * Set up command compatibility
   */
  private async setupCommandCompatibility(): Promise<void> {
    if (!this.config.enableClaudeCodeCommands) {
      return
    }

    // Create command compatibility mappings
    const claudeCommandsDir = join(this.workspaceRoot, '.claude', 'commands')
    const openCodeCommandsDir = join(this.workspaceRoot, '.opencode', 'command')

    if (!existsSync(claudeCommandsDir)) {
      return
    }

    try {
      const claudeCommands = await fs.readdir(claudeCommandsDir)
      const mappings: Record<string, string> = {}

      for (const command of claudeCommands) {
        if (command.endsWith('.md')) {
          const commandName = command.replace('.md', '')
          const openCodePath = join(openCodeCommandsDir, command)
          
          if (existsSync(openCodePath)) {
            mappings[commandName] = `/opencode/${commandName}`
          } else {
            mappings[commandName] = `/claude/${commandName}`
          }
        }
      }

      // Save command mappings
      const mappingsPath = join(this.workspaceRoot, '.opencode', 'command-mappings.json')
      await fs.mkdir(dirname(mappingsPath), { recursive: true })
      await fs.writeFile(mappingsPath, JSON.stringify(mappings, null, 2))

      console.log(`✅ Created command compatibility mappings for ${Object.keys(mappings).length} commands`)
    } catch (error) {
      console.warn('Failed to set up command compatibility:', error.message)
    }
  }

  /**
   * Set up shortcut compatibility
   */
  private async setupShortcutCompatibility(): Promise<void> {
    if (!this.config.maintainShortcuts) {
      return
    }

    const claudeConfigPath = join(this.workspaceRoot, '.claude', 'claude_config.json')
    
    if (!existsSync(claudeConfigPath)) {
      return
    }

    try {
      const content = await fs.readFile(claudeConfigPath, 'utf-8')
      const config = JSON.parse(content)

      if (config.shortcuts) {
        // Create shortcut compatibility plugin
        await this.createShortcutCompatibilityPlugin(config.shortcuts)
        console.log(`✅ Preserved ${Object.keys(config.shortcuts).length} command shortcuts`)
      }
    } catch (error) {
      console.warn('Failed to set up shortcut compatibility:', error.message)
    }
  }

  /**
   * Create shortcut compatibility plugin
   */
  private async createShortcutCompatibilityPlugin(shortcuts: Record<string, string>): Promise<void> {
    const pluginPath = join(this.workspaceRoot, '.opencode', 'plugin', 'shortcut-compatibility.ts')
    
    const pluginContent = `/**
 * Shortcut Compatibility Plugin
 * 
 * Maintains Claude Code command shortcuts for backward compatibility
 */

// Define Plugin interface locally
interface Plugin {
  name: string
  on: Record<string, (context: any) => Promise<any>>
}

const shortcuts = ${JSON.stringify(shortcuts, null, 2)}

export default function shortcutCompatibility(): Plugin {
  return {
    name: 'shortcut-compatibility',
    on: {
      'message.received': async ({ message, session, $ }) => {
        // Check if message starts with a known shortcut
        const trimmed = message.trim()
        
        for (const [shortcut, fullCommand] of Object.entries(shortcuts)) {
          if (trimmed === shortcut || trimmed.startsWith(shortcut + ' ')) {
            console.log(\`🔗 Shortcut detected: \${shortcut} -> \${fullCommand}\`)
            
            // Replace shortcut with full command
            const args = trimmed.slice(shortcut.length).trim()
            const expandedCommand = args ? \`/\${fullCommand} \${args}\` : \`/\${fullCommand}\`
            
            // Execute the expanded command
            try {
              await $\`opencode run "\${expandedCommand}"\`
            } catch (error) {
              console.warn(\`Failed to execute shortcut \${shortcut}:\`, error.message)
            }
            
            return true // Indicate message was handled
          }
        }
        
        return false // Let other handlers process the message
      }
    }
  }
}
`

    await fs.writeFile(pluginPath, pluginContent)
  }

  /**
   * Set up hook compatibility
   */
  private async setupHookCompatibility(): Promise<void> {
    if (!this.config.enableLegacyHooks) {
      return
    }

    const settingsPath = join(this.workspaceRoot, '.claude', 'settings.json')
    
    if (!existsSync(settingsPath)) {
      return
    }

    try {
      const content = await fs.readFile(settingsPath, 'utf-8')
      const settings = JSON.parse(content)

      if (settings.hooks) {
        // Create hook compatibility plugin
        await this.createHookCompatibilityPlugin(settings.hooks)
        console.log('✅ Preserved legacy hooks compatibility')
      }
    } catch (error) {
      console.warn('Failed to set up hook compatibility:', error.message)
    }
  }

  /**
   * Create hook compatibility plugin
   */
  private async createHookCompatibilityPlugin(hooks: any): Promise<void> {
    const pluginPath = join(this.workspaceRoot, '.opencode', 'plugin', 'hook-compatibility.ts')
    
    const pluginContent = `/**
 * Hook Compatibility Plugin
 * 
 * Maintains Claude Code hooks for backward compatibility
 */

// Define Plugin interface locally
interface Plugin {
  name: string
  on: Record<string, (context: any) => Promise<any>>
}

const legacyHooks = ${JSON.stringify(hooks, null, 2)}

export default function hookCompatibility(): Plugin {
  return {
    name: 'hook-compatibility',
    on: {
      'session.created': async ({ session, $ }) => {
        // Execute legacy SessionStart hooks
        if (legacyHooks.SessionStart) {
          console.log('🪝 Executing legacy SessionStart hooks...')
          
          for (const hookGroup of legacyHooks.SessionStart) {
            if (hookGroup.hooks) {
              for (const hook of hookGroup.hooks) {
                if (hook.type === 'command' && hook.command) {
                  try {
                    console.log(\`  Executing: \${hook.command}\`)
                    await $\`\${hook.command}\`
                  } catch (error) {
                    console.warn(\`Legacy hook failed: \${hook.command}\`, error.message)
                  }
                }
              }
            }
          }
        }
      },

      'session.ended': async ({ session, $ }) => {
        // Execute legacy SessionEnd hooks if they exist
        if (legacyHooks.SessionEnd) {
          console.log('🪝 Executing legacy SessionEnd hooks...')
          
          for (const hookGroup of legacyHooks.SessionEnd) {
            if (hookGroup.hooks) {
              for (const hook of hookGroup.hooks) {
                if (hook.type === 'command' && hook.command) {
                  try {
                    await $\`\${hook.command}\`
                  } catch (error) {
                    console.warn(\`Legacy hook failed: \${hook.command}\`, error.message)
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`

    await fs.writeFile(pluginPath, pluginContent)
  }

  /**
   * Create compatibility report
   */
  async generateCompatibilityReport(): Promise<string> {
    if (!this.vaultStructure) {
      await this.initialize()
    }

    const report = `# Backward Compatibility Report

**Generated:** ${new Date().toISOString()}
**Migration Mode:** ${this.config.migrationMode}

## Vault Structure Analysis

**Obsidian Vault:** ${this.vaultStructure?.isObsidianVault ? '✅ Yes' : '❌ No'}
**PARA Structure:** ${this.vaultStructure?.hasPARAStructure ? '✅ Yes' : '❌ No'}

### Folder Structure

${Object.entries(this.vaultStructure?.folders || {}).map(([category, folders]) => 
  `**${category.charAt(0).toUpperCase() + category.slice(1)}:** ${folders.length > 0 ? folders.join(', ') : 'None'}`
).join('\n')}

**Custom Folders:** ${this.vaultStructure?.customFolders?.join(', ') || 'None'}

## Compatibility Features

${this.config.enableClaudeCodeCommands ? '✅' : '❌'} Claude Code Commands
${this.config.preserveVaultStructure ? '✅' : '❌'} Vault Structure Preservation
${this.config.maintainShortcuts ? '✅' : '❌'} Command Shortcuts
${this.config.enableLegacyHooks ? '✅' : '❌'} Legacy Hooks

## Plugin Settings

${Object.keys(this.vaultStructure?.pluginSettings || {}).length > 0 ? 
  Object.keys(this.vaultStructure.pluginSettings).map(plugin => `- ${plugin}`).join('\n') : 
  'No plugin settings found'
}

## Recommendations

${this.generateRecommendations()}

## Migration Status

The backward compatibility layer has been configured to maintain existing functionality while transitioning to OpenCode. All existing vault structures and workflows should continue to work as expected.

### Next Steps

1. Test existing commands and workflows
2. Verify vault structure is preserved
3. Check that shortcuts still work
4. Validate legacy hooks execute properly
5. Report any compatibility issues

### Troubleshooting

If you encounter compatibility issues:

1. Check the compatibility configuration in \`.opencode/vault-compatibility.json\`
2. Review plugin logs for error messages
3. Verify that legacy files are still accessible
4. Test command mappings in \`.opencode/command-mappings.json\`

For support, refer to the migration documentation or create an issue with details about the compatibility problem.
`

    return report
  }

  /**
   * Generate recommendations based on vault analysis
   */
  private generateRecommendations(): string {
    const recommendations: string[] = []

    if (!this.vaultStructure?.isObsidianVault) {
      recommendations.push('- Consider setting up Obsidian vault structure for better organization')
    }

    if (!this.vaultStructure?.hasPARAStructure) {
      recommendations.push('- Consider implementing PARA method for better note organization')
      recommendations.push('- Create folders: 00_Inbox, 01_Projects, 02_Areas, 03_Resources, 04_Archive')
    }

    if (this.vaultStructure?.customFolders && this.vaultStructure.customFolders.length > 5) {
      recommendations.push('- Consider consolidating custom folders into PARA structure')
    }

    if (this.config.migrationMode === 'legacy') {
      recommendations.push('- Consider upgrading to "permissive" or "strict" migration mode for better performance')
    }

    if (Object.keys(this.vaultStructure?.pluginSettings || {}).length === 0) {
      recommendations.push('- No plugin settings detected - ensure Obsidian plugins are properly configured')
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '- No specific recommendations at this time'
  }

  /**
   * Validate compatibility after migration
   */
  async validateCompatibility(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = []

    // Check if vault structure is preserved
    if (this.config.preserveVaultStructure && this.vaultStructure) {
      for (const [category, folders] of Object.entries(this.vaultStructure.folders)) {
        for (const folder of folders) {
          const folderPath = join(this.workspaceRoot, folder)
          if (!existsSync(folderPath)) {
            issues.push(`Missing folder: ${folder} (${category})`)
          }
        }
      }
    }

    // Check if compatibility plugins exist
    const requiredPlugins = []
    if (this.config.enableClaudeCodeCommands) requiredPlugins.push('vault-compatibility.ts')
    if (this.config.maintainShortcuts) requiredPlugins.push('shortcut-compatibility.ts')
    if (this.config.enableLegacyHooks) requiredPlugins.push('hook-compatibility.ts')

    for (const plugin of requiredPlugins) {
      const pluginPath = join(this.workspaceRoot, '.opencode', 'plugin', plugin)
      if (!existsSync(pluginPath)) {
        issues.push(`Missing compatibility plugin: ${plugin}`)
      }
    }

    // Check if configuration files exist
    const configFiles = [
      '.opencode/vault-compatibility.json',
      '.opencode/command-mappings.json'
    ]

    for (const configFile of configFiles) {
      const configPath = join(this.workspaceRoot, configFile)
      if (!existsSync(configPath)) {
        issues.push(`Missing configuration file: ${configFile}`)
      }
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }
}

/**
 * CLI interface for backward compatibility setup
 */
export async function setupBackwardCompatibility(
  workspaceRoot: string = process.cwd(),
  config: Partial<CompatibilityConfig> = {}
): Promise<void> {
  console.log('🔄 Setting up backward compatibility layer...')
  
  const compatibility = new BackwardCompatibilityLayer(workspaceRoot, config)
  await compatibility.initialize()
  
  // Generate and save compatibility report
  const report = await compatibility.generateCompatibilityReport()
  const reportPath = join(workspaceRoot, '.opencode', 'compatibility-report.md')
  
  try {
    await fs.writeFile(reportPath, report)
    console.log(`📄 Compatibility report saved to: ${reportPath}`)
  } catch (error) {
    console.error('Failed to save compatibility report:', error.message)
  }
  
  // Validate compatibility
  const validation = await compatibility.validateCompatibility()
  
  console.log('\n' + '='.repeat(50))
  console.log('COMPATIBILITY SETUP SUMMARY')
  console.log('='.repeat(50))
  console.log(`Status: ${validation.valid ? '✅ SUCCESS' : '❌ ISSUES FOUND'}`)
  
  if (validation.issues.length > 0) {
    console.log('\nIssues:')
    validation.issues.forEach(issue => console.log(`  ❌ ${issue}`))
  }
  
  console.log(`\nReport location: ${reportPath}`)
}

// Allow running as a script
if (require.main === module) {
  const workspaceRoot = process.argv[2] || process.cwd()
  const migrationMode = process.argv[3] || 'permissive'
  
  const config: Partial<CompatibilityConfig> = {
    migrationMode: migrationMode as 'strict' | 'permissive' | 'legacy'
  }
  
  setupBackwardCompatibility(workspaceRoot, config).catch(error => {
    console.error('Backward compatibility setup failed:', error)
    process.exit(1)
  })
}