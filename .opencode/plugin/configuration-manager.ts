/**
 * Configuration Manager Plugin
 * 
 * Handles centralized configuration management for the OpenCode system.
 * Provides configuration loading, validation, and hot-reloading capabilities.
 * 
 * Requirements: 11.1, 11.2, 11.6
 */

import { readFile, writeFile, access, watch } from 'node:fs/promises';
import { existsSync, watchFile, unwatchFile } from 'node:fs';
import { join, resolve } from 'node:path';
import { EventEmitter } from 'node:events';
import {
  OpenCodeConfig,
  ConfigValidationResult,
  ConfigChangeEvent,
  StandardToolResult,
  createSuccessResult,
  createErrorResult,
  ErrorCode,
  PermissionLevel,
  AgentConfig,
  MCPServerConfig,
  MemoryConfig,
  LoggingConfig
} from './types.js';

/**
 * Configuration Manager class
 * Manages the OpenCode configuration system with validation and hot-reloading
 */
export class ConfigurationManager extends EventEmitter {
  private config: OpenCodeConfig | null = null;
  private configPath: string;
  private isWatching = false;
  private watchAbortController: AbortController | null = null;

  constructor(configPath = 'opencode.jsonc') {
    super();
    this.configPath = resolve(configPath);
  }

  /**
   * Load configuration from file
   */
  async loadConfiguration(): Promise<StandardToolResult<OpenCodeConfig>> {
    try {
      // Check if config file exists
      if (!existsSync(this.configPath)) {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Configuration file not found: ${this.configPath}`
        );
      }

      // Read and parse configuration
      const configContent = await readFile(this.configPath, 'utf-8');
      const parsedConfig = this.parseJsonc(configContent);

      // Validate configuration
      const validation = this.validateConfiguration(parsedConfig);
      if (!validation.valid) {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          'Configuration validation failed',
          { errors: validation.errors, warnings: validation.warnings }
        );
      }

      // Apply defaults
      this.config = this.applyDefaults(parsedConfig);

      // Emit configuration loaded event
      this.emit('config.loaded', { config: this.config });

      return createSuccessResult(this.config, {
        warnings: validation.warnings.map(w => w.message)
      });

    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error }
      );
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): OpenCodeConfig | null {
    return this.config;
  }

  /**
   * Get agent configuration by name
   */
  getAgentConfig(agentName: string): AgentConfig | null {
    if (!this.config?.agent) return null;
    return this.config.agent[agentName] || null;
  }

  /**
   * Get MCP server configuration by name
   */
  getMCPServerConfig(serverName: string): MCPServerConfig | null {
    if (!this.config?.mcp) return null;
    return this.config.mcp[serverName] || null;
  }

  /**
   * Get permission for a specific tool and agent
   */
  getPermission(toolName: string, agentName?: string): PermissionLevel {
    if (!this.config) return 'ask';

    // Check agent-specific permissions first
    if (agentName && this.config.agent[agentName]) {
      const agentPermission = this.getPermissionFromConfig(
        this.config.agent[agentName].permission,
        toolName
      );
      if (agentPermission !== null) return agentPermission;
    }

    // Fall back to global permissions
    return this.getPermissionFromConfig(this.config.permission, toolName) || 'ask';
  }

  /**
   * Start watching configuration file for changes
   */
  async startWatching(): Promise<StandardToolResult<void>> {
    if (this.isWatching) {
      return createSuccessResult(undefined, {
        warnings: ['Configuration watching is already active']
      });
    }

    try {
      this.watchAbortController = new AbortController();
      
      // Use fs.watchFile for better cross-platform compatibility
      watchFile(this.configPath, { interval: 1000 }, async (curr, prev) => {
        if (curr.mtime > prev.mtime) {
          await this.handleConfigurationChange();
        }
      });

      this.isWatching = true;
      this.emit('config.watching.started');

      return createSuccessResult(undefined);

    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to start configuration watching: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error }
      );
    }
  }

  /**
   * Stop watching configuration file
   */
  stopWatching(): StandardToolResult<void> {
    if (!this.isWatching) {
      return createSuccessResult(undefined, {
        warnings: ['Configuration watching is not active']
      });
    }

    unwatchFile(this.configPath);
    this.watchAbortController?.abort();
    this.watchAbortController = null;
    this.isWatching = false;
    this.emit('config.watching.stopped');

    return createSuccessResult(undefined);
  }

  /**
   * Update configuration at runtime
   */
  async updateConfiguration(updates: Partial<OpenCodeConfig>): Promise<StandardToolResult<OpenCodeConfig>> {
    if (!this.config) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        'No configuration loaded'
      );
    }

    try {
      // Create updated configuration
      const updatedConfig = this.deepMerge(this.config, updates);

      // Validate updated configuration
      const validation = this.validateConfiguration(updatedConfig);
      if (!validation.valid) {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          'Updated configuration validation failed',
          { errors: validation.errors, warnings: validation.warnings }
        );
      }

      // Apply the update
      const oldConfig = { ...this.config };
      this.config = this.applyDefaults(updatedConfig);

      // Emit change events
      this.emitConfigurationChanges(oldConfig, this.config);
      this.emit('config.updated', { 
        oldConfig, 
        newConfig: this.config,
        updates 
      });

      return createSuccessResult(this.config, {
        warnings: validation.warnings.map(w => w.message)
      });

    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to update configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error }
      );
    }
  }

  /**
   * Save current configuration to file
   */
  async saveConfiguration(): Promise<StandardToolResult<void>> {
    if (!this.config) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        'No configuration to save'
      );
    }

    try {
      const configJson = JSON.stringify(this.config, null, 2);
      await writeFile(this.configPath, configJson, 'utf-8');

      this.emit('config.saved', { config: this.config });

      return createSuccessResult(undefined);

    } catch (error) {
      return createErrorResult(
        ErrorCode.VALIDATION_ERROR,
        `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error }
      );
    }
  }

  /**
   * Handle configuration file changes
   */
  private async handleConfigurationChange(): Promise<void> {
    const oldConfig = this.config ? { ...this.config } : null;
    
    const result = await this.loadConfiguration();
    
    if (result.success && oldConfig && this.config) {
      this.emitConfigurationChanges(oldConfig, this.config);
      this.emit('config.reloaded', { 
        oldConfig, 
        newConfig: this.config 
      });
    } else if (!result.success) {
      this.emit('config.error', { 
        error: result.error,
        path: this.configPath 
      });
    }
  }

  /**
   * Parse JSONC (JSON with comments) content
   */
  private parseJsonc(content: string): any {
    // Remove single-line comments
    content = content.replace(/\/\/.*$/gm, '');
    
    // Remove multi-line comments
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Remove trailing commas
    content = content.replace(/,(\s*[}\]])/g, '$1');
    
    return JSON.parse(content);
  }

  /**
   * Validate configuration structure and values
   */
  private validateConfiguration(config: any): ConfigValidationResult {
    const errors: ConfigValidationResult['errors'] = [];
    const warnings: ConfigValidationResult['warnings'] = [];

    // Check required fields
    if (!config.agent || typeof config.agent !== 'object') {
      errors.push({
        path: 'agent',
        message: 'Agent configuration is required and must be an object'
      });
    }

    if (!config.permission || typeof config.permission !== 'object') {
      errors.push({
        path: 'permission',
        message: 'Permission configuration is required and must be an object'
      });
    }

    // Validate agent configurations
    if (config.agent) {
      for (const [agentName, agentConfig] of Object.entries(config.agent)) {
        this.validateAgentConfig(agentName, agentConfig as any, errors, warnings);
      }
    }

    // Validate MCP server configurations
    if (config.mcp) {
      for (const [serverName, serverConfig] of Object.entries(config.mcp)) {
        this.validateMCPServerConfig(serverName, serverConfig as any, errors, warnings);
      }
    }

    // Validate memory configuration
    if (config.memory) {
      this.validateMemoryConfig(config.memory, errors, warnings);
    }

    // Validate logging configuration
    if (config.logging) {
      this.validateLoggingConfig(config.logging, errors, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate agent configuration
   */
  private validateAgentConfig(
    agentName: string,
    config: any,
    errors: ConfigValidationResult['errors'],
    warnings: ConfigValidationResult['warnings']
  ): void {
    const basePath = `agent.${agentName}`;

    if (!config.description || typeof config.description !== 'string') {
      errors.push({
        path: `${basePath}.description`,
        message: 'Agent description is required and must be a string'
      });
    }

    if (!config.permission || typeof config.permission !== 'object') {
      errors.push({
        path: `${basePath}.permission`,
        message: 'Agent permission configuration is required and must be an object'
      });
    }

    if (config.options && typeof config.options !== 'object') {
      errors.push({
        path: `${basePath}.options`,
        message: 'Agent options must be an object'
      });
    }
  }

  /**
   * Validate MCP server configuration
   */
  private validateMCPServerConfig(
    serverName: string,
    config: any,
    errors: ConfigValidationResult['errors'],
    warnings: ConfigValidationResult['warnings']
  ): void {
    const basePath = `mcp.${serverName}`;

    if (config.command && !Array.isArray(config.command)) {
      errors.push({
        path: `${basePath}.command`,
        message: 'MCP server command must be an array'
      });
    }

    if (config.args && !Array.isArray(config.args)) {
      errors.push({
        path: `${basePath}.args`,
        message: 'MCP server args must be an array'
      });
    }

    if (config.env && typeof config.env !== 'object') {
      errors.push({
        path: `${basePath}.env`,
        message: 'MCP server env must be an object'
      });
    }

    if (config.timeout && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
      errors.push({
        path: `${basePath}.timeout`,
        message: 'MCP server timeout must be a positive number'
      });
    }
  }

  /**
   * Validate memory configuration
   */
  private validateMemoryConfig(
    config: any,
    errors: ConfigValidationResult['errors'],
    warnings: ConfigValidationResult['warnings']
  ): void {
    if (typeof config.enabled !== 'boolean') {
      errors.push({
        path: 'memory.enabled',
        message: 'Memory enabled flag must be a boolean'
      });
    }

    if (config.searchContextSize && (typeof config.searchContextSize !== 'number' || config.searchContextSize <= 0)) {
      errors.push({
        path: 'memory.searchContextSize',
        message: 'Memory search context size must be a positive number'
      });
    }
  }

  /**
   * Validate logging configuration
   */
  private validateLoggingConfig(
    config: any,
    errors: ConfigValidationResult['errors'],
    warnings: ConfigValidationResult['warnings']
  ): void {
    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(config.level)) {
      errors.push({
        path: 'logging.level',
        message: `Logging level must be one of: ${validLevels.join(', ')}`
      });
    }

    if (typeof config.console !== 'boolean') {
      errors.push({
        path: 'logging.console',
        message: 'Logging console flag must be a boolean'
      });
    }
  }

  /**
   * Apply default values to configuration
   */
  private applyDefaults(config: OpenCodeConfig): OpenCodeConfig {
    return {
      ...config,
      memory: {
        enabled: true,
        projectMemoryFile: 'opendian.mv2',
        sessionMemoryPattern: 'session-{date}.mv2',
        autoStore: {
          conversations: true,
          toolResults: true,
          decisions: true,
          plans: true
        },
        searchContextSize: 5,
        ...config.memory
      },
      logging: {
        level: 'info',
        console: true,
        audit: {
          enabled: true,
          includeToolResults: false,
          includeSensitiveData: false
        },
        ...config.logging
      },
      plugins: {
        directory: '.opencode/plugin',
        autoLoad: true,
        ...config.plugins
      },
      events: {
        maxListeners: 100,
        timeout: 30000,
        ...config.events
      }
    };
  }

  /**
   * Get permission from configuration object
   */
  private getPermissionFromConfig(permissionConfig: any, toolName: string): PermissionLevel | null {
    if (!permissionConfig) return null;

    // Direct tool match
    if (permissionConfig[toolName]) {
      const permission = permissionConfig[toolName];
      if (typeof permission === 'string') {
        return permission as PermissionLevel;
      }
    }

    // Pattern matching for tools like bash
    for (const [pattern, permission] of Object.entries(permissionConfig)) {
      if (pattern.includes('*') && this.matchesPattern(toolName, pattern)) {
        if (typeof permission === 'object' && permission !== null) {
          // Handle nested patterns (e.g., bash commands)
          for (const [subPattern, subPermission] of Object.entries(permission)) {
            if (this.matchesPattern(toolName, subPattern)) {
              return subPermission as PermissionLevel;
            }
          }
        } else {
          return permission as PermissionLevel;
        }
      }
    }

    return null;
  }

  /**
   * Check if a string matches a pattern with wildcards
   */
  private matchesPattern(str: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(str);
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Emit configuration change events for specific paths
   */
  private emitConfigurationChanges(oldConfig: OpenCodeConfig, newConfig: OpenCodeConfig): void {
    const changes = this.findConfigurationChanges('', oldConfig, newConfig);
    
    for (const change of changes) {
      this.emit('config.changed', change);
    }
  }

  /**
   * Find configuration changes between old and new config
   */
  private findConfigurationChanges(
    basePath: string,
    oldValue: any,
    newValue: any
  ): ConfigChangeEvent[] {
    const changes: ConfigChangeEvent[] = [];

    if (oldValue === newValue) return changes;

    if (typeof oldValue !== typeof newValue || 
        Array.isArray(oldValue) !== Array.isArray(newValue) ||
        oldValue === null || newValue === null ||
        typeof oldValue !== 'object') {
      changes.push({
        path: basePath,
        oldValue,
        newValue,
        timestamp: Date.now()
      });
      return changes;
    }

    // Compare object properties
    const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
    
    for (const key of allKeys) {
      const path = basePath ? `${basePath}.${key}` : key;
      const subChanges = this.findConfigurationChanges(path, oldValue[key], newValue[key]);
      changes.push(...subChanges);
    }

    return changes;
  }
}

/**
 * Global configuration manager instance
 */
let globalConfigManager: ConfigurationManager | null = null;

/**
 * Get or create the global configuration manager
 */
export function getConfigurationManager(configPath?: string): ConfigurationManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigurationManager(configPath);
  }
  return globalConfigManager;
}

/**
 * Initialize configuration system
 */
export async function initializeConfiguration(configPath?: string): Promise<StandardToolResult<OpenCodeConfig>> {
  const manager = getConfigurationManager(configPath);
  
  const loadResult = await manager.loadConfiguration();
  if (!loadResult.success) {
    return loadResult;
  }

  const watchResult = await manager.startWatching();
  if (!watchResult.success) {
    // Log warning but don't fail initialization
    console.warn('Failed to start configuration watching:', watchResult.error?.message);
  }

  return loadResult;
}

/**
 * Shutdown configuration system
 */
export function shutdownConfiguration(): StandardToolResult<void> {
  if (globalConfigManager) {
    const result = globalConfigManager.stopWatching();
    globalConfigManager = null;
    return result;
  }
  
  return createSuccessResult(undefined);
}