/**
 * Configuration Demo Plugin
 * 
 * Demonstrates configuration system usage and hot-reloading capabilities.
 * This plugin shows how other plugins can react to configuration changes.
 * 
 * Requirements: 11.6
 */

import { getConfigurationManager } from './configuration-manager.js';
import { events } from './event-system.js';
import { StandardToolResult, createSuccessResult, createErrorResult } from './types.js';

/**
 * Configuration Demo Plugin
 * Shows how plugins can use the configuration system
 */
export class ConfigDemoPlugin {
  private configManager = getConfigurationManager();
  private currentConfig: any = null;

  constructor() {
    this.setupConfigurationListeners();
  }

  /**
   * Initialize the demo plugin
   */
  async initialize(): Promise<StandardToolResult<void>> {
    try {
      // Get current configuration
      this.currentConfig = this.configManager.getConfiguration();
      
      if (!this.currentConfig) {
        return createErrorResult(
          'CONFIG_ERROR',
          'No configuration loaded'
        );
      }

      console.log('[ConfigDemo] Plugin initialized with configuration');
      this.logCurrentConfig();

      return createSuccessResult(undefined);

    } catch (error) {
      return createErrorResult(
        'INITIALIZATION_ERROR',
        `Failed to initialize config demo plugin: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error }
      );
    }
  }

  /**
   * Get permission for a tool (demonstrates configuration usage)
   */
  getPermission(toolName: string, agentName?: string): string {
    return this.configManager.getPermission(toolName, agentName);
  }

  /**
   * Get agent configuration (demonstrates configuration usage)
   */
  getAgentConfig(agentName: string): any {
    return this.configManager.getAgentConfig(agentName);
  }

  /**
   * Get MCP server configuration (demonstrates configuration usage)
   */
  getMCPServerConfig(serverName: string): any {
    return this.configManager.getMCPServerConfig(serverName);
  }

  /**
   * Demonstrate runtime configuration update
   */
  async updateConfigurationDemo(): Promise<StandardToolResult<void>> {
    try {
      // Example: Add a new agent configuration
      const updates = {
        agent: {
          'demo-agent': {
            description: 'Demo agent created at runtime',
            permission: {
              'read': 'allow' as const,
              'write': 'ask' as const,
              'bash': {
                '*': 'deny' as const
              }
            },
            options: {
              createdAt: new Date().toISOString()
            }
          }
        }
      };

      const result = await this.configManager.updateConfiguration(updates);
      
      if (result.success) {
        console.log('[ConfigDemo] Configuration updated successfully');
        return createSuccessResult(undefined);
      } else {
        return createErrorResult(
          'UPDATE_ERROR',
          result.error?.message || 'Configuration update failed',
          result.error
        );
      }

    } catch (error) {
      return createErrorResult(
        'UPDATE_ERROR',
        `Failed to update configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error }
      );
    }
  }

  /**
   * Set up configuration event listeners
   */
  private setupConfigurationListeners(): void {
    // Listen for configuration changes
    this.configManager.on('config.loaded', (data) => {
      console.log('[ConfigDemo] Configuration loaded:', Object.keys(data.config));
      this.currentConfig = data.config;
      this.logCurrentConfig();
    });

    this.configManager.on('config.updated', (data) => {
      console.log('[ConfigDemo] Configuration updated');
      this.currentConfig = data.newConfig;
      this.logConfigurationChanges(data.oldConfig, data.newConfig);
    });

    this.configManager.on('config.reloaded', (data) => {
      console.log('[ConfigDemo] Configuration reloaded from file');
      this.currentConfig = data.newConfig;
      this.logConfigurationChanges(data.oldConfig, data.newConfig);
    });

    this.configManager.on('config.changed', (change) => {
      console.log(`[ConfigDemo] Configuration changed at path: ${change.path}`);
      console.log(`  Old value:`, change.oldValue);
      console.log(`  New value:`, change.newValue);
      
      // React to specific configuration changes
      this.handleConfigurationChange(change);
    });

    this.configManager.on('config.error', (data) => {
      console.error('[ConfigDemo] Configuration error:', data.error);
    });

    this.configManager.on('config.watching.started', () => {
      console.log('[ConfigDemo] Configuration file watching started');
    });

    this.configManager.on('config.watching.stopped', () => {
      console.log('[ConfigDemo] Configuration file watching stopped');
    });
  }

  /**
   * Handle specific configuration changes
   */
  private handleConfigurationChange(change: any): void {
    // Example: React to agent configuration changes
    if (change.path.startsWith('agent.')) {
      console.log('[ConfigDemo] Agent configuration changed, updating permissions...');
      // Here you would update any cached permissions or reload agent settings
    }

    // Example: React to MCP server configuration changes
    if (change.path.startsWith('mcp.')) {
      console.log('[ConfigDemo] MCP server configuration changed, restarting servers...');
      // Here you would restart affected MCP servers
    }

    // Example: React to memory configuration changes
    if (change.path.startsWith('memory.')) {
      console.log('[ConfigDemo] Memory configuration changed, updating memory settings...');
      // Here you would update memory management settings
    }

    // Example: React to logging configuration changes
    if (change.path.startsWith('logging.')) {
      console.log('[ConfigDemo] Logging configuration changed, updating log settings...');
      // Here you would update logging configuration
    }
  }

  /**
   * Log current configuration summary
   */
  private logCurrentConfig(): void {
    if (!this.currentConfig) return;

    console.log('[ConfigDemo] Current configuration summary:');
    console.log(`  Agents: ${Object.keys(this.currentConfig.agent || {}).length}`);
    console.log(`  MCP Servers: ${Object.keys(this.currentConfig.mcp || {}).length}`);
    console.log(`  Memory enabled: ${this.currentConfig.memory?.enabled || false}`);
    console.log(`  Logging level: ${this.currentConfig.logging?.level || 'info'}`);
  }

  /**
   * Log configuration changes
   */
  private logConfigurationChanges(oldConfig: any, newConfig: any): void {
    console.log('[ConfigDemo] Configuration changes detected:');
    
    // Compare agent configurations
    const oldAgents = Object.keys(oldConfig.agent || {});
    const newAgents = Object.keys(newConfig.agent || {});
    
    const addedAgents = newAgents.filter(a => !oldAgents.includes(a));
    const removedAgents = oldAgents.filter(a => !newAgents.includes(a));
    
    if (addedAgents.length > 0) {
      console.log(`  Added agents: ${addedAgents.join(', ')}`);
    }
    
    if (removedAgents.length > 0) {
      console.log(`  Removed agents: ${removedAgents.join(', ')}`);
    }

    // Compare MCP server configurations
    const oldServers = Object.keys(oldConfig.mcp || {});
    const newServers = Object.keys(newConfig.mcp || {});
    
    const addedServers = newServers.filter(s => !oldServers.includes(s));
    const removedServers = oldServers.filter(s => !newServers.includes(s));
    
    if (addedServers.length > 0) {
      console.log(`  Added MCP servers: ${addedServers.join(', ')}`);
    }
    
    if (removedServers.length > 0) {
      console.log(`  Removed MCP servers: ${removedServers.join(', ')}`);
    }
  }
}

/**
 * Plugin export for OpenCode plugin system
 */
export default function configDemoPlugin() {
  const plugin = new ConfigDemoPlugin();
  
  return {
    name: 'config-demo',
    version: '1.0.0',
    
    async initialize() {
      return await plugin.initialize();
    },

    // Event handlers
    eventHandlers: {
      'system.initialized': async () => {
        console.log('[ConfigDemo] System initialized, configuration system ready');
      },

      'config.loaded': async (data: any) => {
        console.log('[ConfigDemo] Received config.loaded event');
      },

      'config.updated': async (data: any) => {
        console.log('[ConfigDemo] Received config.updated event');
      }
    },

    // Tools for testing configuration
    tools: {
      'config_demo_get_permission': {
        description: 'Get permission for a tool and agent',
        parameters: {
          type: 'object',
          properties: {
            toolName: { type: 'string', description: 'Name of the tool' },
            agentName: { type: 'string', description: 'Name of the agent (optional)' }
          },
          required: ['toolName']
        },
        handler: async (params: { toolName: string; agentName?: string }) => {
          const permission = plugin.getPermission(params.toolName, params.agentName);
          return createSuccessResult({ 
            toolName: params.toolName,
            agentName: params.agentName,
            permission 
          });
        }
      },

      'config_demo_update': {
        description: 'Demonstrate runtime configuration update',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        },
        handler: async () => {
          return await plugin.updateConfigurationDemo();
        }
      },

      'config_demo_get_agent': {
        description: 'Get agent configuration',
        parameters: {
          type: 'object',
          properties: {
            agentName: { type: 'string', description: 'Name of the agent' }
          },
          required: ['agentName']
        },
        handler: async (params: { agentName: string }) => {
          const config = plugin.getAgentConfig(params.agentName);
          return createSuccessResult({ 
            agentName: params.agentName,
            config 
          });
        }
      }
    }
  };
}

/**
 * Export the plugin instance for direct use
 */
export const configDemo = new ConfigDemoPlugin();