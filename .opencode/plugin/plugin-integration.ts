/**
 * Plugin Integration Layer
 * Connects plugin loader with event system for comprehensive plugin management
 * Requirements: 2.4, 10.2, 10.4, 10.6, 11.1, 11.2, 11.6
 */

import { PluginLoader, PluginInstance } from './plugin-loader';
import { EventSystem, EventScope, EventPriority, events } from './event-system';
import { ConfigurationManager, getConfigurationManager } from './configuration-manager';
import { StandardToolResult, ErrorCode, createSuccessResult, createErrorResult } from './types';

/**
 * Integrated plugin manager that combines loading, event systems, and configuration
 */
export class PluginManager {
  private pluginLoader: PluginLoader;
  private eventSystem: EventSystem;
  private configManager: ConfigurationManager;
  private initialized: boolean = false;

  constructor(pluginDirectory?: string, configPath?: string) {
    this.pluginLoader = new PluginLoader(pluginDirectory);
    this.eventSystem = new EventSystem();
    this.configManager = getConfigurationManager(configPath);
    
    this.setupEventIntegration();
    this.setupConfigurationIntegration();
  }

  /**
   * Initialize the complete plugin system
   */
  async initialize(): Promise<StandardToolResult<{ 
    discovered: string[], 
    loaded: string[], 
    failed: string[] 
  }>> {
    if (this.initialized) {
      return createErrorResult(
        ErrorCode.LIFECYCLE_ERROR,
        'Plugin system already initialized'
      );
    }

    try {
      // Emit system initialization start event
      await events.emit('system.initializing', {});

      // Initialize configuration first
      const configResult = await this.configManager.loadConfiguration();
      if (!configResult.success) {
        await events.emit('system.initialization.failed', { error: configResult.error });
        return createErrorResult(
          ErrorCode.LIFECYCLE_ERROR,
          'Failed to load configuration',
          configResult.error
        );
      }

      // Start configuration watching
      await this.configManager.startWatching();

      // Initialize plugin loader
      const result = await this.pluginLoader.initialize();
      
      if (result.success) {
        this.initialized = true;
        
        // Emit system initialized event
        await events.emit('system.initialized', result.data!);
        
        // Set up plugin event handlers
        await this.setupPluginEventHandlers();
        
        return result;
      } else {
        await events.emit('system.initialization.failed', { error: result.error });
        return result;
      }
      
    } catch (error) {
      await events.emit('system.initialization.failed', { error });
      return createErrorResult(
        ErrorCode.LIFECYCLE_ERROR,
        'Failed to initialize plugin system',
        error
      );
    }
  }

  /**
   * Shutdown the plugin system
   */
  async shutdown(): Promise<StandardToolResult<string[]>> {
    if (!this.initialized) {
      return createErrorResult(
        ErrorCode.LIFECYCLE_ERROR,
        'Plugin system not initialized'
      );
    }

    try {
      // Emit shutdown start event
      await events.emit('system.shutting_down', {});

      // Stop configuration watching
      this.configManager.stopWatching();

      // Shutdown plugin loader
      const result = await this.pluginLoader.shutdown();
      
      if (result.success) {
        this.initialized = false;
        
        // Clean up all plugin events
        this.eventSystem.unsubscribeByScope(EventScope.PLUGIN);
        
        // Emit shutdown complete event
        await events.emit('system.shutdown', { unloaded: result.data! });
        
        return result;
      } else {
        await events.emit('system.shutdown.failed', { error: result.error });
        return result;
      }
      
    } catch (error) {
      await events.emit('system.shutdown.failed', { error });
      return createErrorResult(
        ErrorCode.LIFECYCLE_ERROR,
        'Failed to shutdown plugin system',
        error
      );
    }
  }

  /**
   * Load a specific plugin
   */
  async loadPlugin(pluginName: string): Promise<StandardToolResult<PluginInstance>> {
    const result = await this.pluginLoader.reloadPlugin(pluginName);
    
    if (result.success) {
      // Set up event handlers for the loaded plugin
      await this.setupPluginEventHandler(pluginName, result.data!);
    }
    
    return result;
  }

  /**
   * Unload a specific plugin
   */
  async unloadPlugin(pluginName: string): Promise<StandardToolResult<void>> {
    // Clean up plugin events first
    this.eventSystem.unsubscribeByScope(EventScope.PLUGIN, undefined, pluginName);
    
    return await this.pluginLoader.unloadPlugin(pluginName);
  }

  /**
   * Get configuration manager
   */
  getConfigurationManager(): ConfigurationManager {
    return this.configManager;
  }

  /**
   * Get plugin instance
   */
  getPlugin(pluginName: string): PluginInstance | undefined {
    return this.pluginLoader.getPlugin(pluginName);
  }

  /**
   * Get plugin statistics
   */
  getStats(): {
    plugins: ReturnType<PluginLoader['getStats']>;
    events: ReturnType<EventSystem['getStats']>;
  } {
    return {
      plugins: this.pluginLoader.getStats(),
      events: this.eventSystem.getStats()
    };
  }

  /**
   * Get event system for direct access
   */
  getEventSystem(): EventSystem {
    return this.eventSystem;
  }

  /**
   * Get plugin loader for direct access
   */
  getPluginLoader(): PluginLoader {
    return this.pluginLoader;
  }

  /**
   * Check if system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Private methods
   */

  private setupEventIntegration(): void {
    // Forward plugin loader events to the event system
    this.pluginLoader.on('plugin.loaded', async (data) => {
      await events.emitPlugin('plugin.loaded', data, data.pluginName);
    });

    this.pluginLoader.on('plugin.unloaded', async (data) => {
      await events.emitPlugin('plugin.unloaded', data, data.pluginName);
    });

    this.pluginLoader.on('plugin.failed', async (data) => {
      await events.emitPlugin('plugin.failed', data, data.pluginName);
    });

    this.pluginLoader.on('plugins.loaded', async (data) => {
      await events.emit('plugins.loaded', data);
    });

    this.pluginLoader.on('system.initialized', async (data) => {
      await events.emit('system.initialized', data);
    });

    this.pluginLoader.on('system.shutdown', async (data) => {
      await events.emit('system.shutdown', data);
    });
  }

  private setupConfigurationIntegration(): void {
    // Forward configuration events to the event system
    this.configManager.on('config.loaded', async (data) => {
      await events.emit('config.loaded', data);
    });

    this.configManager.on('config.updated', async (data) => {
      await events.emit('config.updated', data);
    });

    this.configManager.on('config.reloaded', async (data) => {
      await events.emit('config.reloaded', data);
    });

    this.configManager.on('config.changed', async (data) => {
      await events.emit('config.changed', data);
    });

    this.configManager.on('config.error', async (data) => {
      await events.emit('config.error', data);
    });

    this.configManager.on('config.watching.started', async () => {
      await events.emit('config.watching.started', {});
    });

    this.configManager.on('config.watching.stopped', async () => {
      await events.emit('config.watching.stopped', {});
    });
  }

  private async setupPluginEventHandlers(): Promise<void> {
    const loadedPlugins = this.pluginLoader.getLoadedPlugins();
    
    for (const [pluginName, instance] of loadedPlugins.entries()) {
      if (instance.loaded) {
        await this.setupPluginEventHandler(pluginName, instance);
      }
    }
  }

  private async setupPluginEventHandler(pluginName: string, instance: PluginInstance): Promise<void> {
    try {
      // Check if plugin exports event handlers
      const pluginModule = instance.module;
      
      if (pluginModule?.eventHandlers && typeof pluginModule.eventHandlers === 'object') {
        for (const [eventType, handler] of Object.entries(pluginModule.eventHandlers)) {
          if (typeof handler === 'function') {
            // Subscribe to plugin-scoped events
            this.eventSystem.subscribe(
              eventType,
              handler as any,
              {
                scope: EventScope.PLUGIN,
                pluginName,
                priority: EventPriority.NORMAL
              }
            );
          }
        }
      }

      // Check for OpenCode plugin event handler
      if (pluginModule?.default?.event && typeof pluginModule.default.event === 'function') {
        // Subscribe to all events for this plugin
        this.eventSystem.subscribe(
          '*', // Wildcard for all events
          async (event) => {
            try {
              await pluginModule.default.event({ event });
            } catch (error) {
              console.error(`[PluginManager] Plugin ${pluginName} event handler failed:`, error);
            }
          },
          {
            scope: EventScope.PLUGIN,
            pluginName,
            priority: EventPriority.NORMAL
          }
        );
      }

      // Emit plugin ready event
      await events.emitPlugin('plugin.ready', { pluginName, instance }, pluginName);
      
    } catch (error) {
      console.error(`[PluginManager] Failed to setup event handlers for plugin ${pluginName}:`, error);
      await events.emitPlugin('plugin.setup.failed', { pluginName, error }, pluginName);
    }
  }
}

/**
 * Global plugin manager instance
 */
export const globalPluginManager = new PluginManager();

/**
 * Convenience functions for plugin management
 */
export const plugins = {
  /**
   * Initialize plugin system
   */
  initialize: () => globalPluginManager.initialize(),

  /**
   * Shutdown plugin system
   */
  shutdown: () => globalPluginManager.shutdown(),

  /**
   * Load a plugin
   */
  load: (pluginName: string) => globalPluginManager.loadPlugin(pluginName),

  /**
   * Unload a plugin
   */
  unload: (pluginName: string) => globalPluginManager.unloadPlugin(pluginName),

  /**
   * Get a plugin
   */
  get: (pluginName: string) => globalPluginManager.getPlugin(pluginName),

  /**
   * Get statistics
   */
  stats: () => globalPluginManager.getStats(),

  /**
   * Check if initialized
   */
  isReady: () => globalPluginManager.isInitialized(),

  /**
   * Get configuration manager
   */
  config: () => globalPluginManager.getConfigurationManager()
};