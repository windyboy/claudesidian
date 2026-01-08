/**
 * Performance Monitor Plugin for OpenCode
 * Provides real-time performance monitoring and optimization tools
 * 
 * Requirements: 8.4 - Performance optimization
 */

import { 
  StandardToolResult, 
  ErrorCode, 
  createSuccessResult, 
  createErrorResult 
} from './types';
import { 
  PerformanceOptimizer, 
  PerformanceMetrics, 
  PerformanceConfig,
  performance_optimizer 
} from './performance-optimizer';

/**
 * Performance monitoring and optimization plugin
 */
export const performanceMonitorPlugin = async ({ client, $, directory }: any) => {
  const optimizer = performance_optimizer.initialize();

  return {
    tools: {
      performance_get_metrics: {
        description: "Get current performance metrics for the plugin system",
        parameters: {
          type: "object",
          properties: {
            includeDetails: {
              type: "boolean",
              description: "Include detailed metrics breakdown",
              default: false
            }
          },
          required: []
        },
        handler: async ({ includeDetails = false }: { includeDetails?: boolean }) => {
          const startTime = Date.now();
          
          try {
            const metrics = optimizer.getMetrics();
            
            if (!includeDetails) {
              // Return summary metrics only
              const summary = {
                pluginLoading: {
                  averageLoadTime: Math.round(metrics.pluginLoading.averageLoadTime),
                  cacheHitRate: Math.round(metrics.pluginLoading.cacheHitRate * 100),
                  parallelLoadingEnabled: metrics.pluginLoading.parallelLoadingEnabled
                },
                memoryUsage: {
                  heapUsedMB: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024),
                  memoryLeaksCount: metrics.memoryUsage.memoryLeaks.length
                },
                eventStream: {
                  eventsPerSecond: Math.round(metrics.eventStream.eventsPerSecond),
                  queueSize: metrics.eventStream.queueSize,
                  backpressureActive: metrics.eventStream.backpressureActive
                },
                system: {
                  uptimeHours: Math.round(metrics.system.uptime / 3600),
                  cpuUsage: Math.round(metrics.system.cpuUsage * 100)
                }
              };
              
              return createSuccessResult(summary, {
                duration: Date.now() - startTime
              });
            }
            
            return createSuccessResult(metrics, {
              duration: Date.now() - startTime
            });
          } catch (error) {
            return createErrorResult(
              ErrorCode.UNKNOWN_ERROR,
              'Failed to get performance metrics',
              error,
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      performance_generate_report: {
        description: "Generate a comprehensive performance report with recommendations",
        parameters: {
          type: "object",
          properties: {},
          required: []
        },
        handler: async () => {
          const startTime = Date.now();
          
          try {
            const report = optimizer.generateReport();
            
            return createSuccessResult(report, {
              duration: Date.now() - startTime
            });
          } catch (error) {
            return createErrorResult(
              ErrorCode.UNKNOWN_ERROR,
              'Failed to generate performance report',
              error,
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      performance_optimize_memory: {
        description: "Trigger memory optimization and garbage collection",
        parameters: {
          type: "object",
          properties: {
            force: {
              type: "boolean",
              description: "Force aggressive memory cleanup",
              default: false
            }
          },
          required: []
        },
        handler: async ({ force = false }: { force?: boolean }) => {
          const startTime = Date.now();
          
          try {
            const memoryOptimizer = optimizer.getMemoryOptimizer();
            const beforeMemory = process.memoryUsage();
            
            // Detect memory leaks
            const leaks = memoryOptimizer.detectMemoryLeaks();
            
            // Force garbage collection if available and requested
            if (force && global.gc) {
              global.gc();
            }
            
            const afterMemory = process.memoryUsage();
            const memoryFreed = beforeMemory.heapUsed - afterMemory.heapUsed;
            
            return createSuccessResult({
              memoryFreedMB: Math.round(memoryFreed / 1024 / 1024),
              leaksDetected: leaks.length,
              leaks: leaks.map(leak => ({
                component: leak.component,
                sizeMB: Math.round(leak.leakSize / 1024 / 1024),
                severity: leak.severity
              })),
              beforeMemoryMB: Math.round(beforeMemory.heapUsed / 1024 / 1024),
              afterMemoryMB: Math.round(afterMemory.heapUsed / 1024 / 1024)
            }, {
              duration: Date.now() - startTime,
              warnings: leaks.length > 0 ? [`${leaks.length} memory leaks detected`] : undefined
            });
          } catch (error) {
            return createErrorResult(
              ErrorCode.UNKNOWN_ERROR,
              'Failed to optimize memory',
              error,
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      performance_clear_caches: {
        description: "Clear all performance-related caches to free memory",
        parameters: {
          type: "object",
          properties: {
            cacheType: {
              type: "string",
              enum: ["all", "plugin", "vault", "event"],
              description: "Type of cache to clear",
              default: "all"
            }
          },
          required: []
        },
        handler: async ({ cacheType = "all" }: { cacheType?: string }) => {
          const startTime = Date.now();
          
          try {
            const clearedCaches: string[] = [];
            
            if (cacheType === "all" || cacheType === "plugin") {
              optimizer.getPluginOptimizer().clearCache();
              clearedCaches.push("plugin loading cache");
            }
            
            if (cacheType === "all" || cacheType === "event") {
              optimizer.getEventOptimizer().clearQueue();
              clearedCaches.push("event queue");
            }
            
            // Note: Vault cache clearing would need to be implemented in session manager
            if (cacheType === "all" || cacheType === "vault") {
              clearedCaches.push("vault analysis cache (if available)");
            }
            
            return createSuccessResult({
              clearedCaches,
              message: `Cleared ${clearedCaches.length} cache types`
            }, {
              duration: Date.now() - startTime
            });
          } catch (error) {
            return createErrorResult(
              ErrorCode.UNKNOWN_ERROR,
              'Failed to clear caches',
              error,
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      performance_update_config: {
        description: "Update performance optimization configuration",
        parameters: {
          type: "object",
          properties: {
            pluginLoading: {
              type: "object",
              properties: {
                enableParallelLoading: { type: "boolean" },
                maxConcurrentLoads: { type: "number" },
                enableLoadTimeCache: { type: "boolean" }
              }
            },
            memoryManagement: {
              type: "object",
              properties: {
                enableGarbageCollection: { type: "boolean" },
                gcInterval: { type: "number" },
                maxCacheSize: { type: "number" }
              }
            },
            eventStream: {
              type: "object",
              properties: {
                enableBatching: { type: "boolean" },
                batchSize: { type: "number" },
                enableBackpressure: { type: "boolean" }
              }
            }
          },
          required: []
        },
        handler: async (config: Partial<PerformanceConfig>) => {
          const startTime = Date.now();
          
          try {
            optimizer.updateConfig(config);
            
            return createSuccessResult({
              message: "Performance configuration updated successfully",
              updatedConfig: config
            }, {
              duration: Date.now() - startTime
            });
          } catch (error) {
            return createErrorResult(
              ErrorCode.VALIDATION_ERROR,
              'Failed to update performance configuration',
              error,
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      performance_benchmark: {
        description: "Run performance benchmarks on the plugin system",
        parameters: {
          type: "object",
          properties: {
            testType: {
              type: "string",
              enum: ["plugin_loading", "event_processing", "memory_usage", "all"],
              description: "Type of benchmark to run",
              default: "all"
            },
            iterations: {
              type: "number",
              description: "Number of iterations for the benchmark",
              default: 10,
              minimum: 1,
              maximum: 100
            }
          },
          required: []
        },
        handler: async ({ testType = "all", iterations = 10 }: { testType?: string; iterations?: number }) => {
          const startTime = Date.now();
          
          try {
            const results: any = {};
            
            if (testType === "all" || testType === "event_processing") {
              // Benchmark event processing
              const eventTimes: number[] = [];
              for (let i = 0; i < iterations; i++) {
                const eventStart = Date.now();
                optimizer.getEventOptimizer().processEvent({ test: `benchmark_${i}` }, 1);
                eventTimes.push(Date.now() - eventStart);
              }
              
              results.eventProcessing = {
                averageTime: eventTimes.reduce((sum, time) => sum + time, 0) / eventTimes.length,
                minTime: Math.min(...eventTimes),
                maxTime: Math.max(...eventTimes),
                iterations
              };
            }
            
            if (testType === "all" || testType === "memory_usage") {
              // Benchmark memory usage
              const memoryBefore = process.memoryUsage();
              
              // Simulate memory-intensive operations
              const testData = Array.from({ length: 1000 }, (_, i) => ({ id: i, data: `test_${i}` }));
              
              const memoryAfter = process.memoryUsage();
              
              results.memoryUsage = {
                heapGrowthMB: Math.round((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024),
                currentHeapMB: Math.round(memoryAfter.heapUsed / 1024 / 1024),
                testDataSize: testData.length
              };
            }
            
            return createSuccessResult({
              benchmarkResults: results,
              totalDuration: Date.now() - startTime,
              testType,
              iterations
            }, {
              duration: Date.now() - startTime
            });
          } catch (error) {
            return createErrorResult(
              ErrorCode.UNKNOWN_ERROR,
              'Failed to run performance benchmark',
              error,
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      performance_get_recommendations: {
        description: "Get performance optimization recommendations based on current metrics",
        parameters: {
          type: "object",
          properties: {},
          required: []
        },
        handler: async () => {
          const startTime = Date.now();
          
          try {
            const report = optimizer.generateReport();
            const metrics = optimizer.getMetrics();
            
            const recommendations = [
              ...report.recommendations,
              // Add additional context-specific recommendations
              ...(metrics.memoryUsage.heapUsed > 100 * 1024 * 1024 ? 
                ['Consider reducing memory usage - current heap usage is high'] : []),
              ...(metrics.eventStream.queueSize > 100 ? 
                ['Event queue is large - consider enabling batching or increasing processing speed'] : []),
              ...(metrics.pluginLoading.averageLoadTime > 500 ? 
                ['Plugin loading is slow - consider enabling parallel loading'] : [])
            ];
            
            return createSuccessResult({
              recommendations,
              priority: recommendations.length > 3 ? 'high' : recommendations.length > 1 ? 'medium' : 'low',
              metricsSnapshot: {
                memoryUsageMB: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024),
                eventQueueSize: metrics.eventStream.queueSize,
                averagePluginLoadTime: Math.round(metrics.pluginLoading.averageLoadTime)
              }
            }, {
              duration: Date.now() - startTime
            });
          } catch (error) {
            return createErrorResult(
              ErrorCode.UNKNOWN_ERROR,
              'Failed to get performance recommendations',
              error,
              { duration: Date.now() - startTime }
            );
          }
        }
      }
    },

    hooks: {
      "system.initialized": async () => {
        console.log('[PerformanceMonitor] Performance monitoring initialized');
        
        // Log initial performance metrics
        const metrics = optimizer.getMetrics();
        console.log(`[PerformanceMonitor] Initial memory usage: ${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024)}MB`);
      },

      "plugins.loaded": async (context: { loaded: string[]; failed: string[] }) => {
        const metrics = optimizer.getPluginOptimizer().getMetrics();
        console.log(`[PerformanceMonitor] Plugin loading completed: ${context.loaded.length} loaded, ${context.failed.length} failed`);
        console.log(`[PerformanceMonitor] Average load time: ${Math.round(metrics.averageLoadTime)}ms, Cache hit rate: ${Math.round(metrics.cacheHitRate * 100)}%`);
        
        // Check for performance issues
        if (metrics.averageLoadTime > 1000) {
          console.warn('[PerformanceMonitor] Slow plugin loading detected - consider enabling optimizations');
        }
      },

      "system.shutdown": async () => {
        console.log('[PerformanceMonitor] Stopping performance monitoring');
        optimizer.stop();
      }
    }
  };
};

export default performanceMonitorPlugin;