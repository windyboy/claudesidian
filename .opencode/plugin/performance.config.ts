/**
 * Performance Configuration for OpenCode Plugin System
 * Optimized settings for production use
 */

import { PerformanceConfig } from './performance-optimizer';

/**
 * Production-optimized performance configuration
 */
export const PRODUCTION_PERFORMANCE_CONFIG: PerformanceConfig = {
  pluginLoading: {
    enableParallelLoading: true,
    maxConcurrentLoads: 6, // Increased for better performance
    enableLoadTimeCache: true,
    cacheTimeout: 600000, // 10 minutes
    preloadCriticalPlugins: [
      'vault-context',
      'permission-manager', 
      'session-manager',
      'memory-management'
    ]
  },
  memoryManagement: {
    enableGarbageCollection: true,
    gcInterval: 30000, // 30 seconds - more frequent
    maxCacheSize: 150, // 150MB - increased limit
    enableMemoryLeakDetection: true,
    memoryThreshold: 750 // 750MB - higher threshold for production
  },
  eventStream: {
    enableBatching: true,
    batchSize: 20, // Larger batches for efficiency
    batchTimeout: 50, // Faster batching - 50ms
    enableBackpressure: true,
    maxQueueSize: 2000, // Larger queue for high throughput
    enableEventPrioritization: true
  },
  monitoring: {
    enableMetricsCollection: true,
    metricsInterval: 10000, // 10 seconds
    enablePerformanceLogging: true,
    logThreshold: 200 // 200ms threshold for warnings
  }
};

/**
 * Development-optimized performance configuration
 */
export const DEVELOPMENT_PERFORMANCE_CONFIG: PerformanceConfig = {
  pluginLoading: {
    enableParallelLoading: true,
    maxConcurrentLoads: 3, // Lower for development
    enableLoadTimeCache: false, // Disabled for hot reloading
    cacheTimeout: 60000, // 1 minute
    preloadCriticalPlugins: [
      'vault-context',
      'permission-manager'
    ]
  },
  memoryManagement: {
    enableGarbageCollection: true,
    gcInterval: 15000, // 15 seconds - more frequent for development
    maxCacheSize: 50, // 50MB - lower for development
    enableMemoryLeakDetection: true,
    memoryThreshold: 300 // 300MB - lower threshold for early detection
  },
  eventStream: {
    enableBatching: false, // Disabled for immediate feedback
    batchSize: 5,
    batchTimeout: 200, // Slower for debugging
    enableBackpressure: true,
    maxQueueSize: 500, // Smaller queue
    enableEventPrioritization: false // Disabled for simpler debugging
  },
  monitoring: {
    enableMetricsCollection: true,
    metricsInterval: 5000, // 5 seconds - more frequent
    enablePerformanceLogging: true,
    logThreshold: 50 // 50ms threshold - more sensitive
  }
};

/**
 * Memory-constrained performance configuration
 * For systems with limited memory
 */
export const MEMORY_CONSTRAINED_CONFIG: PerformanceConfig = {
  pluginLoading: {
    enableParallelLoading: false, // Sequential to reduce memory spikes
    maxConcurrentLoads: 1,
    enableLoadTimeCache: true,
    cacheTimeout: 120000, // 2 minutes - shorter cache
    preloadCriticalPlugins: [
      'vault-context' // Only most critical
    ]
  },
  memoryManagement: {
    enableGarbageCollection: true,
    gcInterval: 10000, // 10 seconds - very frequent
    maxCacheSize: 25, // 25MB - very low
    enableMemoryLeakDetection: true,
    memoryThreshold: 150 // 150MB - very low threshold
  },
  eventStream: {
    enableBatching: true,
    batchSize: 5, // Small batches
    batchTimeout: 100,
    enableBackpressure: true,
    maxQueueSize: 100, // Very small queue
    enableEventPrioritization: true
  },
  monitoring: {
    enableMetricsCollection: true,
    metricsInterval: 15000, // 15 seconds - less frequent
    enablePerformanceLogging: false, // Disabled to save memory
    logThreshold: 100
  }
};

/**
 * High-performance configuration
 * For systems with abundant resources
 */
export const HIGH_PERFORMANCE_CONFIG: PerformanceConfig = {
  pluginLoading: {
    enableParallelLoading: true,
    maxConcurrentLoads: 8, // Maximum parallelism
    enableLoadTimeCache: true,
    cacheTimeout: 1800000, // 30 minutes - long cache
    preloadCriticalPlugins: [
      'vault-context',
      'permission-manager',
      'session-manager',
      'memory-management',
      'plan-mode',
      'mcp-router'
    ]
  },
  memoryManagement: {
    enableGarbageCollection: true,
    gcInterval: 60000, // 1 minute - less frequent
    maxCacheSize: 500, // 500MB - very high
    enableMemoryLeakDetection: true,
    memoryThreshold: 2000 // 2GB - very high threshold
  },
  eventStream: {
    enableBatching: true,
    batchSize: 50, // Large batches
    batchTimeout: 25, // Very fast batching
    enableBackpressure: true,
    maxQueueSize: 5000, // Very large queue
    enableEventPrioritization: true
  },
  monitoring: {
    enableMetricsCollection: true,
    metricsInterval: 30000, // 30 seconds - less frequent
    enablePerformanceLogging: true,
    logThreshold: 500 // 500ms - less sensitive
  }
};

/**
 * Get performance configuration based on environment
 */
export function getPerformanceConfig(environment?: string): PerformanceConfig {
  switch (environment?.toLowerCase()) {
    case 'production':
    case 'prod':
      return PRODUCTION_PERFORMANCE_CONFIG;
    
    case 'development':
    case 'dev':
      return DEVELOPMENT_PERFORMANCE_CONFIG;
    
    case 'memory-constrained':
    case 'low-memory':
      return MEMORY_CONSTRAINED_CONFIG;
    
    case 'high-performance':
    case 'high-perf':
      return HIGH_PERFORMANCE_CONFIG;
    
    default:
      // Auto-detect based on available memory
      const totalMemoryMB = process.memoryUsage().heapTotal / 1024 / 1024;
      
      if (totalMemoryMB < 100) {
        console.log('[PerformanceConfig] Auto-selected memory-constrained configuration');
        return MEMORY_CONSTRAINED_CONFIG;
      } else if (totalMemoryMB > 1000) {
        console.log('[PerformanceConfig] Auto-selected high-performance configuration');
        return HIGH_PERFORMANCE_CONFIG;
      } else {
        console.log('[PerformanceConfig] Auto-selected production configuration');
        return PRODUCTION_PERFORMANCE_CONFIG;
      }
  }
}

/**
 * Performance configuration presets
 */
export const PERFORMANCE_PRESETS = {
  production: PRODUCTION_PERFORMANCE_CONFIG,
  development: DEVELOPMENT_PERFORMANCE_CONFIG,
  memoryConstrained: MEMORY_CONSTRAINED_CONFIG,
  highPerformance: HIGH_PERFORMANCE_CONFIG
} as const;

export type PerformancePreset = keyof typeof PERFORMANCE_PRESETS;