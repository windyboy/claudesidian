/**
 * Performance Optimizer for OpenCode Plugin System
 * Implements comprehensive performance optimizations for plugin loading, memory usage, and event streaming
 * 
 * Requirements: 8.4 - Performance optimization
 */

import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';
import { 
  StandardToolResult, 
  ErrorCode, 
  createSuccessResult, 
  createErrorResult 
} from './types';

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  pluginLoading: {
    totalLoadTime: number;
    averageLoadTime: number;
    loadTimesByPlugin: Record<string, number>;
    parallelLoadingEnabled: boolean;
    cacheHitRate: number;
  };
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    cacheSize: number;
    memoryLeaks: Array<{ plugin: string; size: number; timestamp: number }>;
  };
  eventStream: {
    eventsPerSecond: number;
    averageProcessingTime: number;
    queueSize: number;
    droppedEvents: number;
    backpressureActive: boolean;
  };
  system: {
    cpuUsage: number;
    uptime: number;
    gcStats: {
      collections: number;
      totalTime: number;
      averageTime: number;
    };
  };
}

/**
 * Performance optimization configuration
 */
export interface PerformanceConfig {
  pluginLoading: {
    enableParallelLoading: boolean;
    maxConcurrentLoads: number;
    enableLoadTimeCache: boolean;
    cacheTimeout: number; // milliseconds
    preloadCriticalPlugins: string[];
  };
  memoryManagement: {
    enableGarbageCollection: boolean;
    gcInterval: number; // milliseconds
    maxCacheSize: number; // MB
    enableMemoryLeakDetection: boolean;
    memoryThreshold: number; // MB
  };
  eventStream: {
    enableBatching: boolean;
    batchSize: number;
    batchTimeout: number; // milliseconds
    enableBackpressure: boolean;
    maxQueueSize: number;
    enableEventPrioritization: boolean;
  };
  monitoring: {
    enableMetricsCollection: boolean;
    metricsInterval: number; // milliseconds
    enablePerformanceLogging: boolean;
    logThreshold: number; // milliseconds
  };
}

/**
 * Default performance configuration
 */
const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  pluginLoading: {
    enableParallelLoading: true,
    maxConcurrentLoads: 4,
    enableLoadTimeCache: true,
    cacheTimeout: 300000, // 5 minutes
    preloadCriticalPlugins: ['vault-context', 'permission-manager', 'session-manager']
  },
  memoryManagement: {
    enableGarbageCollection: true,
    gcInterval: 60000, // 1 minute
    maxCacheSize: 100, // 100MB
    enableMemoryLeakDetection: true,
    memoryThreshold: 500 // 500MB
  },
  eventStream: {
    enableBatching: true,
    batchSize: 10,
    batchTimeout: 100, // 100ms
    enableBackpressure: true,
    maxQueueSize: 1000,
    enableEventPrioritization: true
  },
  monitoring: {
    enableMetricsCollection: true,
    metricsInterval: 5000, // 5 seconds
    enablePerformanceLogging: true,
    logThreshold: 100 // 100ms
  }
};

/**
 * Plugin loading optimizer
 */
export class PluginLoadingOptimizer {
  private config: PerformanceConfig['pluginLoading'];
  private loadTimeCache: Map<string, { time: number; timestamp: number }> = new Map();
  private loadingQueue: Array<{ pluginName: string; resolve: Function; reject: Function }> = [];
  private activeLoads: Set<string> = new Set();
  private metrics: PerformanceMetrics['pluginLoading'];

  constructor(config: PerformanceConfig['pluginLoading']) {
    this.config = config;
    this.metrics = {
      totalLoadTime: 0,
      averageLoadTime: 0,
      loadTimesByPlugin: {},
      parallelLoadingEnabled: config.enableParallelLoading,
      cacheHitRate: 0
    };
  }

  /**
   * Optimize plugin loading with parallel execution and caching
   */
  async optimizePluginLoading(
    pluginNames: string[],
    loadFunction: (pluginName: string) => Promise<any>
  ): Promise<StandardToolResult<{ loaded: string[]; failed: string[]; metrics: any }>> {
    const startTime = performance.now();
    const loaded: string[] = [];
    const failed: string[] = [];
    let cacheHits = 0;

    try {
      // Preload critical plugins first
      const criticalPlugins = pluginNames.filter(name => 
        this.config.preloadCriticalPlugins.includes(name)
      );
      const regularPlugins = pluginNames.filter(name => 
        !this.config.preloadCriticalPlugins.includes(name)
      );

      // Load critical plugins sequentially for stability
      for (const pluginName of criticalPlugins) {
        try {
          const loadResult = await this.loadPluginWithOptimization(pluginName, loadFunction);
          if (loadResult.cacheHit) cacheHits++;
          loaded.push(pluginName);
        } catch (error) {
          console.error(`Failed to load critical plugin ${pluginName}:`, error);
          failed.push(pluginName);
        }
      }

      // Load regular plugins in parallel if enabled
      if (this.config.enableParallelLoading && regularPlugins.length > 0) {
        const results = await this.loadPluginsInParallel(regularPlugins, loadFunction);
        loaded.push(...results.loaded);
        failed.push(...results.failed);
        cacheHits += results.cacheHits;
      } else {
        // Sequential loading fallback
        for (const pluginName of regularPlugins) {
          try {
            const loadResult = await this.loadPluginWithOptimization(pluginName, loadFunction);
            if (loadResult.cacheHit) cacheHits++;
            loaded.push(pluginName);
          } catch (error) {
            console.error(`Failed to load plugin ${pluginName}:`, error);
            failed.push(pluginName);
          }
        }
      }

      // Update metrics
      const totalTime = performance.now() - startTime;
      this.updateLoadingMetrics(loaded, totalTime, cacheHits, pluginNames.length);

      return createSuccessResult({
        loaded,
        failed,
        metrics: {
          totalTime,
          averageTime: totalTime / pluginNames.length,
          cacheHitRate: cacheHits / pluginNames.length,
          parallelLoading: this.config.enableParallelLoading
        }
      });

    } catch (error) {
      return createErrorResult(
        ErrorCode.LIFECYCLE_ERROR,
        'Plugin loading optimization failed',
        error
      );
    }
  }

  /**
   * Load plugins in parallel with concurrency control
   */
  private async loadPluginsInParallel(
    pluginNames: string[],
    loadFunction: (pluginName: string) => Promise<any>
  ): Promise<{ loaded: string[]; failed: string[]; cacheHits: number }> {
    const loaded: string[] = [];
    const failed: string[] = [];
    let cacheHits = 0;

    // Process plugins in batches to control concurrency
    const batches = this.createBatches(pluginNames, this.config.maxConcurrentLoads);

    for (const batch of batches) {
      const batchPromises = batch.map(async (pluginName) => {
        try {
          const result = await this.loadPluginWithOptimization(pluginName, loadFunction);
          return { pluginName, success: true, cacheHit: result.cacheHit };
        } catch (error) {
          return { pluginName, success: false, error, cacheHit: false };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const { pluginName, success, cacheHit } = result.value;
          if (success) {
            loaded.push(pluginName);
            if (cacheHit) cacheHits++;
          } else {
            failed.push(pluginName);
          }
        } else {
          console.error('Batch loading error:', result.reason);
        }
      }
    }

    return { loaded, failed, cacheHits };
  }

  /**
   * Load single plugin with caching optimization
   */
  private async loadPluginWithOptimization(
    pluginName: string,
    loadFunction: (pluginName: string) => Promise<any>
  ): Promise<{ result: any; cacheHit: boolean }> {
    const startTime = performance.now();

    // Check cache if enabled
    if (this.config.enableLoadTimeCache) {
      const cached = this.loadTimeCache.get(pluginName);
      if (cached && (Date.now() - cached.timestamp) < this.config.cacheTimeout) {
        return { result: null, cacheHit: true };
      }
    }

    // Load plugin
    const result = await loadFunction(pluginName);
    const loadTime = performance.now() - startTime;

    // Cache load time
    if (this.config.enableLoadTimeCache) {
      this.loadTimeCache.set(pluginName, {
        time: loadTime,
        timestamp: Date.now()
      });
    }

    // Store metrics
    this.metrics.loadTimesByPlugin[pluginName] = loadTime;

    return { result, cacheHit: false };
  }

  /**
   * Create batches for parallel processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Update loading metrics
   */
  private updateLoadingMetrics(
    loadedPlugins: string[],
    totalTime: number,
    cacheHits: number,
    totalPlugins: number
  ): void {
    this.metrics.totalLoadTime = totalTime;
    this.metrics.averageLoadTime = totalTime / Math.max(loadedPlugins.length, 1);
    this.metrics.cacheHitRate = cacheHits / Math.max(totalPlugins, 1);
  }

  /**
   * Get loading metrics
   */
  getMetrics(): PerformanceMetrics['pluginLoading'] {
    return { ...this.metrics };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.loadTimeCache.clear();
  }
}

/**
 * Memory usage optimizer
 */
export class MemoryOptimizer {
  private config: PerformanceConfig['memoryManagement'];
  private gcTimer: NodeJS.Timeout | null = null;
  private memorySnapshots: Array<{ timestamp: number; usage: NodeJS.MemoryUsage }> = [];
  private leakDetectionBaseline: NodeJS.MemoryUsage | null = null;

  constructor(config: PerformanceConfig['memoryManagement']) {
    this.config = config;
    this.startMemoryMonitoring();
  }

  /**
   * Start memory monitoring and optimization
   */
  private startMemoryMonitoring(): void {
    if (this.config.enableGarbageCollection) {
      this.gcTimer = setInterval(() => {
        this.performGarbageCollection();
      }, this.config.gcInterval);
    }

    // Take baseline snapshot for leak detection
    if (this.config.enableMemoryLeakDetection) {
      this.leakDetectionBaseline = process.memoryUsage();
    }
  }

  /**
   * Perform garbage collection and memory cleanup
   */
  private performGarbageCollection(): void {
    const beforeGC = process.memoryUsage();
    
    // Force garbage collection if available
    if (global.gc) {
      const gcStart = performance.now();
      global.gc();
      const gcTime = performance.now() - gcStart;
      
      const afterGC = process.memoryUsage();
      const memoryFreed = beforeGC.heapUsed - afterGC.heapUsed;
      
      if (this.config.enablePerformanceLogging && memoryFreed > 1024 * 1024) { // Log if > 1MB freed
        console.log(`[MemoryOptimizer] GC freed ${Math.round(memoryFreed / 1024 / 1024)}MB in ${Math.round(gcTime)}ms`);
      }
    }

    // Check memory threshold
    const currentUsage = process.memoryUsage();
    const heapUsedMB = currentUsage.heapUsed / 1024 / 1024;
    
    if (heapUsedMB > this.config.memoryThreshold) {
      console.warn(`[MemoryOptimizer] Memory usage (${Math.round(heapUsedMB)}MB) exceeds threshold (${this.config.memoryThreshold}MB)`);
      this.performEmergencyCleanup();
    }

    // Store snapshot for trend analysis
    this.memorySnapshots.push({
      timestamp: Date.now(),
      usage: currentUsage
    });

    // Keep only last 100 snapshots
    if (this.memorySnapshots.length > 100) {
      this.memorySnapshots.shift();
    }
  }

  /**
   * Perform emergency memory cleanup
   */
  private performEmergencyCleanup(): void {
    // Clear old snapshots
    this.memorySnapshots = this.memorySnapshots.slice(-10);
    
    // Force multiple GC cycles
    if (global.gc) {
      for (let i = 0; i < 3; i++) {
        global.gc();
      }
    }
    
    console.log('[MemoryOptimizer] Emergency cleanup completed');
  }

  /**
   * Detect memory leaks
   */
  detectMemoryLeaks(): Array<{ component: string; leakSize: number; severity: 'low' | 'medium' | 'high' }> {
    if (!this.config.enableMemoryLeakDetection || !this.leakDetectionBaseline) {
      return [];
    }

    const currentUsage = process.memoryUsage();
    const leaks: Array<{ component: string; leakSize: number; severity: 'low' | 'medium' | 'high' }> = [];

    // Check heap growth
    const heapGrowth = currentUsage.heapUsed - this.leakDetectionBaseline.heapUsed;
    if (heapGrowth > 50 * 1024 * 1024) { // 50MB growth
      const severity = heapGrowth > 200 * 1024 * 1024 ? 'high' : 
                      heapGrowth > 100 * 1024 * 1024 ? 'medium' : 'low';
      
      leaks.push({
        component: 'heap',
        leakSize: heapGrowth,
        severity
      });
    }

    // Check external memory growth
    const externalGrowth = currentUsage.external - this.leakDetectionBaseline.external;
    if (externalGrowth > 20 * 1024 * 1024) { // 20MB growth
      const severity = externalGrowth > 100 * 1024 * 1024 ? 'high' : 
                      externalGrowth > 50 * 1024 * 1024 ? 'medium' : 'low';
      
      leaks.push({
        component: 'external',
        leakSize: externalGrowth,
        severity
      });
    }

    return leaks;
  }

  /**
   * Get memory metrics
   */
  getMetrics(): PerformanceMetrics['memoryUsage'] {
    const currentUsage = process.memoryUsage();
    const leaks = this.detectMemoryLeaks();

    return {
      heapUsed: currentUsage.heapUsed,
      heapTotal: currentUsage.heapTotal,
      external: currentUsage.external,
      rss: currentUsage.rss,
      cacheSize: 0, // Will be updated by cache implementations
      memoryLeaks: leaks.map(leak => ({
        plugin: leak.component,
        size: leak.leakSize,
        timestamp: Date.now()
      }))
    };
  }

  /**
   * Optimize cache sizes based on memory pressure
   */
  optimizeCacheSizes(caches: Array<{ name: string; size: number; clear: () => void }>): void {
    const currentUsage = process.memoryUsage();
    const heapUsedMB = currentUsage.heapUsed / 1024 / 1024;
    
    if (heapUsedMB > this.config.memoryThreshold * 0.8) { // 80% of threshold
      // Clear largest caches first
      const sortedCaches = caches.sort((a, b) => b.size - a.size);
      
      for (const cache of sortedCaches.slice(0, Math.ceil(caches.length / 2))) {
        console.log(`[MemoryOptimizer] Clearing cache: ${cache.name} (${Math.round(cache.size / 1024 / 1024)}MB)`);
        cache.clear();
      }
    }
  }

  /**
   * Stop memory monitoring
   */
  stop(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }
}

/**
 * Event stream optimizer
 */
export class EventStreamOptimizer extends EventEmitter {
  private config: PerformanceConfig['eventStream'];
  private eventQueue: Array<{ event: any; priority: number; timestamp: number }> = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private processingStats = {
    eventsProcessed: 0,
    totalProcessingTime: 0,
    droppedEvents: 0,
    lastProcessTime: Date.now()
  };

  constructor(config: PerformanceConfig['eventStream']) {
    super();
    this.config = config;
    this.setMaxListeners(1000); // Increase max listeners for performance
  }

  /**
   * Optimize event processing with batching and backpressure
   */
  processEvent(event: any, priority: number = 1): boolean {
    // Check backpressure
    if (this.config.enableBackpressure && this.eventQueue.length >= this.config.maxQueueSize) {
      this.processingStats.droppedEvents++;
      console.warn('[EventStreamOptimizer] Event dropped due to backpressure');
      return false;
    }

    // Add to queue with priority
    this.eventQueue.push({
      event,
      priority,
      timestamp: Date.now()
    });

    // Sort by priority if prioritization is enabled
    if (this.config.enableEventPrioritization) {
      this.eventQueue.sort((a, b) => b.priority - a.priority);
    }

    // Start batch processing if enabled
    if (this.config.enableBatching) {
      this.scheduleBatchProcessing();
    } else {
      this.processNextEvent();
    }

    return true;
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatchProcessing(): void {
    if (this.batchTimer) return;

    // Process immediately if batch is full
    if (this.eventQueue.length >= this.config.batchSize) {
      this.processBatch();
      return;
    }

    // Schedule batch processing
    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.config.batchTimeout);
  }

  /**
   * Process a batch of events
   */
  private processBatch(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.eventQueue.length === 0) return;

    const startTime = performance.now();
    const batchSize = Math.min(this.config.batchSize, this.eventQueue.length);
    const batch = this.eventQueue.splice(0, batchSize);

    // Process batch
    for (const { event } of batch) {
      this.emit('event', event);
    }

    // Update stats
    const processingTime = performance.now() - startTime;
    this.processingStats.eventsProcessed += batch.length;
    this.processingStats.totalProcessingTime += processingTime;
    this.processingStats.lastProcessTime = Date.now();

    // Continue processing if more events in queue
    if (this.eventQueue.length > 0) {
      this.scheduleBatchProcessing();
    }
  }

  /**
   * Process single event (non-batched mode)
   */
  private processNextEvent(): void {
    if (this.eventQueue.length === 0) return;

    const startTime = performance.now();
    const { event } = this.eventQueue.shift()!;

    this.emit('event', event);

    // Update stats
    const processingTime = performance.now() - startTime;
    this.processingStats.eventsProcessed++;
    this.processingStats.totalProcessingTime += processingTime;
    this.processingStats.lastProcessTime = Date.now();
  }

  /**
   * Get event stream metrics
   */
  getMetrics(): PerformanceMetrics['eventStream'] {
    const now = Date.now();
    const timeSinceLastProcess = now - this.processingStats.lastProcessTime;
    const eventsPerSecond = timeSinceLastProcess > 0 ? 
      (this.processingStats.eventsProcessed * 1000) / timeSinceLastProcess : 0;

    return {
      eventsPerSecond,
      averageProcessingTime: this.processingStats.eventsProcessed > 0 ?
        this.processingStats.totalProcessingTime / this.processingStats.eventsProcessed : 0,
      queueSize: this.eventQueue.length,
      droppedEvents: this.processingStats.droppedEvents,
      backpressureActive: this.eventQueue.length >= this.config.maxQueueSize * 0.8
    };
  }

  /**
   * Clear event queue
   */
  clearQueue(): void {
    this.eventQueue = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Stop event processing
   */
  stop(): void {
    this.clearQueue();
    this.removeAllListeners();
  }
}

/**
 * Main performance optimizer class
 */
export class PerformanceOptimizer {
  private config: PerformanceConfig;
  private pluginOptimizer: PluginLoadingOptimizer;
  private memoryOptimizer: MemoryOptimizer;
  private eventOptimizer: EventStreamOptimizer;
  private metricsTimer: NodeJS.Timeout | null = null;
  private metrics: PerformanceMetrics;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
    
    this.pluginOptimizer = new PluginLoadingOptimizer(this.config.pluginLoading);
    this.memoryOptimizer = new MemoryOptimizer(this.config.memoryManagement);
    this.eventOptimizer = new EventStreamOptimizer(this.config.eventStream);
    
    this.metrics = this.initializeMetrics();
    
    if (this.config.monitoring.enableMetricsCollection) {
      this.startMetricsCollection();
    }
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      pluginLoading: this.pluginOptimizer.getMetrics(),
      memoryUsage: this.memoryOptimizer.getMetrics(),
      eventStream: this.eventOptimizer.getMetrics(),
      system: {
        cpuUsage: 0,
        uptime: process.uptime(),
        gcStats: {
          collections: 0,
          totalTime: 0,
          averageTime: 0
        }
      }
    };
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
    }, this.config.monitoring.metricsInterval);
  }

  /**
   * Update all metrics
   */
  private updateMetrics(): void {
    this.metrics = {
      pluginLoading: this.pluginOptimizer.getMetrics(),
      memoryUsage: this.memoryOptimizer.getMetrics(),
      eventStream: this.eventOptimizer.getMetrics(),
      system: {
        cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
        uptime: process.uptime(),
        gcStats: this.metrics.system.gcStats // Keep existing GC stats
      }
    };

    // Log performance warnings
    if (this.config.monitoring.enablePerformanceLogging) {
      this.logPerformanceWarnings();
    }
  }

  /**
   * Log performance warnings
   */
  private logPerformanceWarnings(): void {
    const { memoryUsage, eventStream, pluginLoading } = this.metrics;
    
    // Memory warnings
    if (memoryUsage.heapUsed > this.config.memoryManagement.memoryThreshold * 1024 * 1024) {
      console.warn(`[PerformanceOptimizer] High memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
    }

    // Event stream warnings
    if (eventStream.backpressureActive) {
      console.warn(`[PerformanceOptimizer] Event stream backpressure active, queue size: ${eventStream.queueSize}`);
    }

    // Plugin loading warnings
    if (pluginLoading.averageLoadTime > this.config.monitoring.logThreshold) {
      console.warn(`[PerformanceOptimizer] Slow plugin loading: ${Math.round(pluginLoading.averageLoadTime)}ms average`);
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get plugin loading optimizer
   */
  getPluginOptimizer(): PluginLoadingOptimizer {
    return this.pluginOptimizer;
  }

  /**
   * Get memory optimizer
   */
  getMemoryOptimizer(): MemoryOptimizer {
    return this.memoryOptimizer;
  }

  /**
   * Get event stream optimizer
   */
  getEventOptimizer(): EventStreamOptimizer {
    return this.eventOptimizer;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart metrics collection if interval changed
    if (this.metricsTimer && newConfig.monitoring?.metricsInterval) {
      clearInterval(this.metricsTimer);
      this.startMetricsCollection();
    }
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    summary: string;
    recommendations: string[];
    metrics: PerformanceMetrics;
  } {
    const recommendations: string[] = [];
    const { pluginLoading, memoryUsage, eventStream } = this.metrics;

    // Plugin loading recommendations
    if (pluginLoading.averageLoadTime > 1000) {
      recommendations.push('Consider enabling parallel plugin loading to reduce startup time');
    }
    if (pluginLoading.cacheHitRate < 0.5) {
      recommendations.push('Plugin load time caching is not effective, consider increasing cache timeout');
    }

    // Memory recommendations
    if (memoryUsage.memoryLeaks.length > 0) {
      recommendations.push(`Memory leaks detected in ${memoryUsage.memoryLeaks.length} components`);
    }
    if (memoryUsage.heapUsed > this.config.memoryManagement.memoryThreshold * 1024 * 1024 * 0.8) {
      recommendations.push('Memory usage is approaching threshold, consider reducing cache sizes');
    }

    // Event stream recommendations
    if (eventStream.droppedEvents > 0) {
      recommendations.push('Events are being dropped, consider increasing queue size or enabling backpressure');
    }
    if (eventStream.averageProcessingTime > 50) {
      recommendations.push('Event processing is slow, consider enabling batching');
    }

    const summary = `Performance Report: ${pluginLoading.loadTimesByPlugin ? Object.keys(pluginLoading.loadTimesByPlugin).length : 0} plugins loaded, ` +
                   `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB memory used, ` +
                   `${Math.round(eventStream.eventsPerSecond)} events/sec processed`;

    return {
      summary,
      recommendations,
      metrics: this.metrics
    };
  }

  /**
   * Stop performance optimization
   */
  stop(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
    
    this.memoryOptimizer.stop();
    this.eventOptimizer.stop();
  }
}

/**
 * Global performance optimizer instance
 */
export const globalPerformanceOptimizer = new PerformanceOptimizer();

/**
 * Convenience functions for performance optimization
 */
export const performance_optimizer = {
  /**
   * Initialize performance optimization
   */
  initialize: (config?: Partial<PerformanceConfig>) => {
    if (config) {
      globalPerformanceOptimizer.updateConfig(config);
    }
    return globalPerformanceOptimizer;
  },

  /**
   * Get current metrics
   */
  metrics: () => globalPerformanceOptimizer.getMetrics(),

  /**
   * Generate performance report
   */
  report: () => globalPerformanceOptimizer.generateReport(),

  /**
   * Optimize plugin loading
   */
  optimizePluginLoading: (pluginNames: string[], loadFunction: (name: string) => Promise<any>) =>
    globalPerformanceOptimizer.getPluginOptimizer().optimizePluginLoading(pluginNames, loadFunction),

  /**
   * Process event with optimization
   */
  processEvent: (event: any, priority?: number) =>
    globalPerformanceOptimizer.getEventOptimizer().processEvent(event, priority),

  /**
   * Detect memory leaks
   */
  detectMemoryLeaks: () => globalPerformanceOptimizer.getMemoryOptimizer().detectMemoryLeaks(),

  /**
   * Stop optimization
   */
  stop: () => globalPerformanceOptimizer.stop()
};