/**
 * Plugin Dependency System
 * Manages plugin dependencies and loading order
 */

import { EventEmitter } from 'node:events';
import { StandardToolResult, ErrorCode, createSuccessResult, createErrorResult } from './types';
import { PluginLoadingOptimizer, performance_optimizer } from './performance-optimizer';

export interface PluginDependency {
  name: string // Dependency plugin name
  version?: string // Optional version requirement (e.g., ">=1.0.0")
  optional?: boolean // Whether this is an optional dependency
}

export interface PluginConfig {
  name: string
  version: string
  dependencies?: PluginDependency[] // List of plugin dependencies
  loadOrder?: number // Load order (if dependencies not specified, use this)
  enabled?: boolean // Whether plugin is enabled (default: true)
}

export interface PluginInstance {
  config: PluginConfig
  module: any
  loaded: boolean
  loadTime: number
  error?: Error
}

export enum PluginLifecycleState {
  UNLOADED = 'unloaded',
  LOADING = 'loading', 
  LOADED = 'loaded',
  FAILED = 'failed',
  UNLOADING = 'unloading'
}

/**
 * Plugin Loader with dependency resolution and lifecycle management
 */
export class PluginLoader extends EventEmitter {
  private plugins: Map<string, PluginConfig> = new Map()
  private loadedPlugins: Map<string, PluginInstance> = new Map()
  private pluginStates: Map<string, PluginLifecycleState> = new Map()
  private loadingOrder: string[] = []
  private pluginDirectory: string = '.opencode/plugin'
  private performanceOptimizer: PluginLoadingOptimizer

  constructor(pluginDirectory?: string) {
    super()
    if (pluginDirectory) {
      this.pluginDirectory = pluginDirectory
    }
    
    // Initialize performance optimizer
    this.performanceOptimizer = performance_optimizer.initialize().getPluginOptimizer()
  }

  /**
   * Register a plugin configuration
   */
  register(plugin: PluginConfig): void {
    // Set default enabled state
    if (plugin.enabled === undefined) {
      plugin.enabled = true
    }
    
    this.plugins.set(plugin.name, plugin)
    this.pluginStates.set(plugin.name, PluginLifecycleState.UNLOADED)
    
    this.emit('plugin.registered', { plugin })
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginName: string): void {
    const plugin = this.plugins.get(pluginName)
    if (plugin) {
      this.plugins.delete(pluginName)
      this.pluginStates.delete(pluginName)
      
      // Unload if currently loaded
      if (this.loadedPlugins.has(pluginName)) {
        this.unloadPlugin(pluginName)
      }
      
      this.emit('plugin.unregistered', { pluginName })
    }
  }

  /**
   * Resolve dependencies and calculate load order (topological sort)
   * Returns ordered list of plugin names
   */
  resolveDependencies(): string[] {
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const order: string[] = []

    // Detect circular dependencies
    const hasCycle = (pluginName: string): boolean => {
      if (visiting.has(pluginName)) {
        return true // Circular dependency detected
      }
      if (visited.has(pluginName)) {
        return false
      }

      visiting.add(pluginName)
      const plugin = this.plugins.get(pluginName)

      if (plugin?.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!dep.optional && hasCycle(dep.name)) {
            return true
          }
        }
      }

      visiting.delete(pluginName)
      visited.add(pluginName)
      return false
    }

    // Check all plugins for circular dependencies
    for (const pluginName of this.plugins.keys()) {
      if (hasCycle(pluginName)) {
        throw new Error(`Circular dependency detected involving plugin: ${pluginName}`)
      }
    }

    // Topological sort
    const inDegree = new Map<string, number>()
    const graph = new Map<string, string[]>()

    // Initialize
    for (const pluginName of this.plugins.keys()) {
      inDegree.set(pluginName, 0)
      graph.set(pluginName, [])
    }

    // Build dependency graph
    for (const [pluginName, plugin] of this.plugins.entries()) {
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!dep.optional) {
            const currentInDegree = inDegree.get(pluginName) || 0
            inDegree.set(pluginName, currentInDegree + 1)

            const depDeps = graph.get(dep.name) || []
            depDeps.push(pluginName)
            graph.set(dep.name, depDeps)
          }
        }
      }
    }

    // Topological sort (Kahn's algorithm)
    const queue: string[] = []
    for (const [pluginName, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(pluginName)
      }
    }

    while (queue.length > 0) {
      // Sort queue by loadOrder if available, otherwise maintain insertion order
      queue.sort((a, b) => {
        const pluginA = this.plugins.get(a)
        const pluginB = this.plugins.get(b)
        const orderA = pluginA?.loadOrder ?? 0
        const orderB = pluginB?.loadOrder ?? 0
        return orderA - orderB
      })

      const pluginName = queue.shift()!
      order.push(pluginName)

      const dependents = graph.get(pluginName) || []
      for (const dependent of dependents) {
        const currentInDegree = inDegree.get(dependent)! - 1
        inDegree.set(dependent, currentInDegree)

        if (currentInDegree === 0) {
          queue.push(dependent)
        }
      }
    }

    // If there are unprocessed plugins, there's a circular dependency or missing dependencies
    if (order.length !== this.plugins.size) {
      const missing = Array.from(this.plugins.keys()).filter(name => !order.includes(name))
      throw new Error(
        `Circular dependency detected or missing dependencies. Unprocessed plugins: ${missing.join(', ')}`
      )
    }

    return order
  }

  /**
   * Load all plugins in dependency order with performance optimization
   */
  async loadAll(): Promise<StandardToolResult<{ loaded: string[], failed: string[] }>> {
    try {
      const loadOrder = this.resolveDependencies()
      this.loadingOrder = loadOrder

      // Use performance optimizer for plugin loading
      const optimizedResult = await this.performanceOptimizer.optimizePluginLoading(
        loadOrder.filter(name => this.plugins.get(name)?.enabled !== false),
        async (pluginName: string) => {
          const result = await this.loadPlugin(pluginName)
          if (!result.success) {
            throw new Error(result.error?.message || 'Plugin load failed')
          }
          return result.data
        }
      )

      if (optimizedResult.success) {
        const { loaded, failed, metrics } = optimizedResult.data!
        
        // Log performance metrics
        console.log(`[PluginLoader] Loaded ${loaded.length} plugins in ${Math.round(metrics.totalTime)}ms (avg: ${Math.round(metrics.averageTime)}ms, cache hit rate: ${Math.round(metrics.cacheHitRate * 100)}%)`)
        
        this.emit('plugins.loaded', { loaded, failed })
        
        return createSuccessResult({ loaded, failed }, {
          duration: metrics.totalTime,
          warnings: failed.length > 0 ? [`Failed to load ${failed.length} plugins: ${failed.join(', ')}`] : undefined
        })
      } else {
        return optimizedResult as StandardToolResult<{ loaded: string[], failed: string[] }>
      }
      
    } catch (error) {
      this.emit('plugins.load.error', { error })
      return createErrorResult(
        ErrorCode.LIFECYCLE_ERROR,
        'Failed to load plugins',
        error
      )
    }
  }

  /**
   * Load a single plugin with lifecycle management
   */
  private async loadPlugin(pluginName: string): Promise<StandardToolResult<PluginInstance>> {
    const startTime = Date.now()
    
    if (this.loadedPlugins.has(pluginName)) {
      return createSuccessResult(this.loadedPlugins.get(pluginName)!) // Already loaded
    }

    const plugin = this.plugins.get(pluginName)
    if (!plugin) {
      return createErrorResult(
        ErrorCode.DEPENDENCY_ERROR,
        `Plugin ${pluginName} not found`
      )
    }

    // Set loading state
    this.pluginStates.set(pluginName, PluginLifecycleState.LOADING)
    this.emit('plugin.loading', { pluginName })

    try {
      // Ensure all dependencies are loaded
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!dep.optional && !this.loadedPlugins.has(dep.name)) {
            throw new Error(`Dependency ${dep.name} of plugin ${pluginName} is not loaded`)
          }
        }
      }

      // Load the plugin module
      const pluginPath = `${this.pluginDirectory}/${pluginName}.ts`
      let pluginModule: any
      
      try {
        // Dynamic import for TypeScript modules
        pluginModule = await import(pluginPath)
      } catch (importError) {
        // Try .js extension as fallback
        const jsPath = `${this.pluginDirectory}/${pluginName}.js`
        pluginModule = await import(jsPath)
      }

      const instance: PluginInstance = {
        config: plugin,
        module: pluginModule,
        loaded: true,
        loadTime: Date.now() - startTime
      }

      this.loadedPlugins.set(pluginName, instance)
      this.pluginStates.set(pluginName, PluginLifecycleState.LOADED)
      
      this.emit('plugin.loaded', { pluginName, instance })
      
      return createSuccessResult(instance, {
        duration: instance.loadTime
      })
      
    } catch (error) {
      // Set failed state
      this.pluginStates.set(pluginName, PluginLifecycleState.FAILED)
      
      const instance: PluginInstance = {
        config: plugin,
        module: null,
        loaded: false,
        loadTime: Date.now() - startTime,
        error: error as Error
      }
      
      this.loadedPlugins.set(pluginName, instance)
      this.emit('plugin.failed', { pluginName, error })
      
      return createErrorResult(
        ErrorCode.LIFECYCLE_ERROR,
        `Failed to load plugin ${pluginName}`,
        error,
        { duration: instance.loadTime }
      )
    }
  }

  /**
   * Unload a single plugin
   */
  async unloadPlugin(pluginName: string): Promise<StandardToolResult<void>> {
    const instance = this.loadedPlugins.get(pluginName)
    if (!instance) {
      return createErrorResult(
        ErrorCode.LIFECYCLE_ERROR,
        `Plugin ${pluginName} is not loaded`
      )
    }

    try {
      this.pluginStates.set(pluginName, PluginLifecycleState.UNLOADING)
      this.emit('plugin.unloading', { pluginName })

      // Call plugin cleanup if available
      if (instance.module?.cleanup && typeof instance.module.cleanup === 'function') {
        await instance.module.cleanup()
      }

      this.loadedPlugins.delete(pluginName)
      this.pluginStates.set(pluginName, PluginLifecycleState.UNLOADED)
      
      this.emit('plugin.unloaded', { pluginName })
      
      return createSuccessResult(undefined)
      
    } catch (error) {
      this.emit('plugin.unload.error', { pluginName, error })
      return createErrorResult(
        ErrorCode.LIFECYCLE_ERROR,
        `Failed to unload plugin ${pluginName}`,
        error
      )
    }
  }

  /**
   * Reload a plugin
   */
  async reloadPlugin(pluginName: string): Promise<StandardToolResult<PluginInstance>> {
    // Unload first
    const unloadResult = await this.unloadPlugin(pluginName)
    if (!unloadResult.success) {
      return unloadResult as StandardToolResult<PluginInstance>
    }

    // Then load again
    return await this.loadPlugin(pluginName)
  }

  /**
   * Get a loaded plugin instance
   */
  getPlugin(pluginName: string): PluginInstance | undefined {
    return this.loadedPlugins.get(pluginName)
  }

  /**
   * Get plugin state
   */
  getPluginState(pluginName: string): PluginLifecycleState {
    return this.pluginStates.get(pluginName) || PluginLifecycleState.UNLOADED
  }

  /**
   * Check if plugin is loaded
   */
  isPluginLoaded(pluginName: string): boolean {
    const instance = this.loadedPlugins.get(pluginName)
    return instance?.loaded === true
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): Map<string, PluginInstance> {
    return new Map(this.loadedPlugins)
  }

  /**
   * Get plugin statistics
   */
  getStats(): {
    total: number
    loaded: number
    failed: number
    disabled: number
    averageLoadTime: number
  } {
    const total = this.plugins.size
    const loaded = Array.from(this.loadedPlugins.values()).filter(p => p.loaded).length
    const failed = Array.from(this.loadedPlugins.values()).filter(p => !p.loaded && p.error).length
    const disabled = Array.from(this.plugins.values()).filter(p => !p.enabled).length
    
    const loadTimes = Array.from(this.loadedPlugins.values())
      .filter(p => p.loaded)
      .map(p => p.loadTime)
    const averageLoadTime = loadTimes.length > 0 
      ? loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length 
      : 0

    return {
      total,
      loaded,
      failed,
      disabled,
      averageLoadTime
    }
  }

  /**
   * Auto-discover and register plugins from the plugin directory
   */
  async discoverPlugins(): Promise<StandardToolResult<string[]>> {
    try {
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      
      const discovered: string[] = []
      
      try {
        const files = await fs.readdir(this.pluginDirectory)
        
        for (const file of files) {
          const filePath = path.join(this.pluginDirectory, file)
          const stat = await fs.stat(filePath)
          
          if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.js'))) {
            const pluginName = path.basename(file, path.extname(file))
            
            // Skip if already registered
            if (this.plugins.has(pluginName)) {
              continue
            }
            
            try {
              // Try to load plugin metadata
              const pluginModule = await import(filePath)
              
              // Look for plugin configuration
              const config = pluginModule.config || pluginModule.default?.config || {
                name: pluginName,
                version: '1.0.0'
              }
              
              // Ensure name matches filename
              config.name = pluginName
              
              this.register(config)
              discovered.push(pluginName)
              
            } catch (error) {
              console.warn(`[PluginLoader] Failed to discover plugin ${pluginName}:`, error)
            }
          }
        }
        
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          // Plugin directory doesn't exist, create it
          await fs.mkdir(this.pluginDirectory, { recursive: true })
        } else {
          throw error
        }
      }
      
      this.emit('plugins.discovered', { discovered })
      
      return createSuccessResult(discovered, {
        warnings: discovered.length === 0 ? ['No plugins discovered'] : undefined
      })
      
    } catch (error) {
      return createErrorResult(
        ErrorCode.LIFECYCLE_ERROR,
        'Failed to discover plugins',
        error
      )
    }
  }

  /**
   * Get plugin configuration
   */
  getConfig(pluginName: string): PluginConfig | undefined {
    return this.plugins.get(pluginName)
  }

  /**
   * Validate all plugin dependencies exist
   */
  validateDependencies(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    for (const [pluginName, plugin] of this.plugins.entries()) {
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!dep.optional && !this.plugins.has(dep.name)) {
            errors.push(`Plugin ${pluginName} depends on ${dep.name}, which is not registered`)
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Initialize plugin system - discover and load all plugins
   */
  async initialize(): Promise<StandardToolResult<{ discovered: string[], loaded: string[], failed: string[] }>> {
    try {
      // First discover plugins
      const discoverResult = await this.discoverPlugins()
      if (!discoverResult.success) {
        return createErrorResult(
          ErrorCode.LIFECYCLE_ERROR,
          'Failed to discover plugins',
          discoverResult.error
        ) as StandardToolResult<{ discovered: string[], loaded: string[], failed: string[] }>
      }
      
      // Then load all plugins
      const loadResult = await this.loadAll()
      if (!loadResult.success) {
        return createErrorResult(
          ErrorCode.LIFECYCLE_ERROR,
          'Failed to load plugins',
          loadResult.error
        ) as StandardToolResult<{ discovered: string[], loaded: string[], failed: string[] }>
      }
      
      const result = {
        discovered: discoverResult.data || [],
        loaded: loadResult.data?.loaded || [],
        failed: loadResult.data?.failed || []
      }
      
      this.emit('system.initialized', result)
      
      return createSuccessResult(result)
      
    } catch (error) {
      return createErrorResult(
        ErrorCode.LIFECYCLE_ERROR,
        'Failed to initialize plugin system',
        error
      )
    }
  }

  /**
   * Shutdown plugin system - unload all plugins
   */
  async shutdown(): Promise<StandardToolResult<string[]>> {
    try {
      const unloaded: string[] = []
      
      // Unload in reverse order
      const loadOrder = [...this.loadingOrder].reverse()
      
      for (const pluginName of loadOrder) {
        if (this.isPluginLoaded(pluginName)) {
          const result = await this.unloadPlugin(pluginName)
          if (result.success) {
            unloaded.push(pluginName)
          }
        }
      }
      
      this.emit('system.shutdown', { unloaded })
      
      return createSuccessResult(unloaded)
      
    } catch (error) {
      return createErrorResult(
        ErrorCode.LIFECYCLE_ERROR,
        'Failed to shutdown plugin system',
        error
      )
    }
  }
}