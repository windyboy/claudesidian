/**
 * OpenCode Plugin System Entry Point
 * Exports all plugin system components for easy integration
 */

// Core plugin system
export { PluginLoader, type PluginInstance, PluginLifecycleState } from './plugin-loader';
export { EventSystem, EventScope, EventPriority, globalEventSystem, events } from './event-system';
export { PluginManager, globalPluginManager, plugins } from './plugin-integration';

// Configuration system
export { ConfigurationManager, getConfigurationManager, initializeConfiguration, shutdownConfiguration } from './configuration-manager';

// Performance optimization
export { 
  PerformanceOptimizer, 
  PluginLoadingOptimizer, 
  MemoryOptimizer, 
  EventStreamOptimizer,
  globalPerformanceOptimizer,
  performance_optimizer,
  type PerformanceMetrics,
  type PerformanceConfig
} from './performance-optimizer';
export { default as performanceMonitorPlugin } from './performance-monitor';

// Types and interfaces
export * from './types';

// Utility functions
export { createSuccessResult, createErrorResult } from './types';

/**
 * Initialize the complete plugin system with configuration and performance optimization
 * This is the main entry point for starting the plugin system
 */
export async function initializePluginSystem(pluginDirectory?: string, configPath?: string) {
  const { PluginManager, globalPluginManager } = await import('./plugin-integration');
  const manager = (pluginDirectory || configPath) ? new PluginManager(pluginDirectory, configPath) : globalPluginManager;
  
  // Initialize performance optimization
  performance_optimizer.initialize();
  
  return await manager.initialize();
}

/**
 * Shutdown the complete plugin system
 */
export async function shutdownPluginSystem() {
  const { globalPluginManager } = await import('./plugin-integration');
  
  // Stop performance optimization
  performance_optimizer.stop();
  
  return await globalPluginManager.shutdown();
}

/**
 * Quick access to commonly used functionality
 */
export const system = {
  // Plugin management
  get plugins() { 
    const { plugins } = require('./plugin-integration');
    return plugins;
  },
  
  // Event system
  get events() {
    const { events } = require('./event-system');
    return events;
  },
  
  // Configuration system
  get config() {
    const { getConfigurationManager } = require('./configuration-manager');
    return getConfigurationManager();
  },
  
  // Performance optimization
  get performance() {
    const { performance_optimizer } = require('./performance-optimizer');
    return performance_optimizer;
  },
  
  // Initialization
  init: initializePluginSystem,
  shutdown: shutdownPluginSystem,
  
  // Status
  async isReady() {
    const { globalPluginManager } = await import('./plugin-integration');
    return globalPluginManager.isInitialized();
  },
  async stats() {
    const { globalPluginManager } = await import('./plugin-integration');
    const pluginStats = globalPluginManager.getStats();
    const performanceStats = performance_optimizer.metrics();
    
    return {
      plugins: pluginStats,
      performance: performanceStats
    };
  }
};