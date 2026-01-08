/**
 * Comprehensive Event System for OpenCode Plugins
 * Implements event emission, scoping, and listener management
 * Requirements: 10.2, 10.4, 10.6
 */

import { EventEmitter } from 'node:events';
import { StandardToolResult, ErrorCode, createSuccessResult, createErrorResult } from './types';
import { EventStreamOptimizer, performance_optimizer } from './performance-optimizer';

/**
 * Event scoping types
 */
export enum EventScope {
  GLOBAL = 'global',
  SESSION = 'session',
  PLUGIN = 'plugin'
}

/**
 * Event priority levels
 */
export enum EventPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Event metadata
 */
export interface EventMetadata {
  timestamp: number;
  source: string;
  scope: EventScope;
  sessionId?: string;
  pluginName?: string;
  priority: EventPriority;
  tags?: string[];
  correlationId?: string;
}

/**
 * Event data structure
 */
export interface SystemEvent<T = any> {
  type: string;
  data: T;
  metadata: EventMetadata;
}

/**
 * Event listener configuration
 */
export interface EventListener {
  id: string;
  eventType: string;
  handler: (event: SystemEvent) => Promise<void> | void;
  scope: EventScope;
  sessionId?: string;
  pluginName?: string;
  priority: EventPriority;
  once?: boolean;
  filter?: (event: SystemEvent) => boolean;
}

/**
 * Event subscription result
 */
export interface EventSubscription {
  id: string;
  unsubscribe: () => void;
}

/**
 * Event system statistics
 */
export interface EventStats {
  totalEvents: number;
  totalListeners: number;
  eventsByType: Record<string, number>;
  listenersByScope: Record<EventScope, number>;
  averageProcessingTime: number;
  failedEvents: number;
}

/**
 * Comprehensive event system implementation
 */
export class EventSystem extends EventEmitter {
  private eventListeners: Map<string, EventListener[]> = new Map();
  private eventHistory: SystemEvent[] = [];
  private stats: EventStats = {
    totalEvents: 0,
    totalListeners: 0,
    eventsByType: {},
    listenersByScope: { [EventScope.GLOBAL]: 0, [EventScope.SESSION]: 0, [EventScope.PLUGIN]: 0 },
    averageProcessingTime: 0,
    failedEvents: 0
  };
  private processingTimes: number[] = [];
  private maxHistorySize: number = 1000;
  private listenerIdCounter: number = 0;
  private streamOptimizer: EventStreamOptimizer;

  constructor(maxHistorySize?: number) {
    super();
    if (maxHistorySize) {
      this.maxHistorySize = maxHistorySize;
    }
    
    // Set high max listeners to prevent warnings
    this.setMaxListeners(1000);
    
    // Initialize stream optimizer
    this.streamOptimizer = performance_optimizer.initialize().getEventOptimizer();
    
    // Forward optimized events
    this.streamOptimizer.on('event', (event) => {
      super.emit(event.type, event);
    });
  }

  /**
   * Emit an event with proper scoping and metadata (optimized)
   */
  async emitEvent<T>(
    eventType: string,
    data: T,
    options: {
      scope?: EventScope;
      sessionId?: string;
      pluginName?: string;
      priority?: EventPriority;
      tags?: string[];
      correlationId?: string;
    } = {}
  ): Promise<StandardToolResult<void>> {
    const startTime = Date.now();
    
    try {
      const event: SystemEvent<T> = {
        type: eventType,
        data,
        metadata: {
          timestamp: startTime,
          source: options.pluginName || 'system',
          scope: options.scope || EventScope.GLOBAL,
          sessionId: options.sessionId,
          pluginName: options.pluginName,
          priority: options.priority || EventPriority.NORMAL,
          tags: options.tags,
          correlationId: options.correlationId
        }
      };

      // Add to history
      this.addToHistory(event);

      // Update statistics
      this.stats.totalEvents++;
      this.stats.eventsByType[eventType] = (this.stats.eventsByType[eventType] || 0) + 1;

      // Use stream optimizer for event processing
      const processed = this.streamOptimizer.processEvent(event, options.priority || EventPriority.NORMAL);
      
      if (!processed) {
        this.stats.failedEvents++;
        return createErrorResult(
          ErrorCode.UNKNOWN_ERROR,
          'Event dropped due to backpressure',
          { eventType, queueSize: this.streamOptimizer.getMetrics().queueSize }
        );
      }

      // Update processing time statistics
      const processingTime = Date.now() - startTime;
      this.processingTimes.push(processingTime);
      if (this.processingTimes.length > 100) {
        this.processingTimes.shift(); // Keep only last 100 measurements
      }
      this.stats.averageProcessingTime = 
        this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;

      // Emit internal event for monitoring
      super.emit('event.processed', { event, processingTime });

      return createSuccessResult(undefined, {
        duration: processingTime
      });

    } catch (error) {
      this.stats.failedEvents++;
      super.emit('event.error', { eventType, error });
      
      return createErrorResult(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to emit event ${eventType}`,
        error,
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Subscribe to events with filtering and scoping
   */
  subscribe(
    eventType: string,
    handler: (event: SystemEvent) => Promise<void> | void,
    options: {
      scope?: EventScope;
      sessionId?: string;
      pluginName?: string;
      priority?: EventPriority;
      once?: boolean;
      filter?: (event: SystemEvent) => boolean;
    } = {}
  ): EventSubscription {
    const listener: EventListener = {
      id: `listener_${++this.listenerIdCounter}`,
      eventType,
      handler,
      scope: options.scope || EventScope.GLOBAL,
      sessionId: options.sessionId,
      pluginName: options.pluginName,
      priority: options.priority || EventPriority.NORMAL,
      once: options.once,
      filter: options.filter
    };

    // Add to listeners map
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);

    // Update statistics
    this.stats.totalListeners++;
    this.stats.listenersByScope[listener.scope]++;

    // Emit subscription event
    super.emit('listener.subscribed', { listener });

    return {
      id: listener.id,
      unsubscribe: () => this.unsubscribe(listener.id)
    };
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(listenerId: string): boolean {
    for (const [eventType, listeners] of this.eventListeners.entries()) {
      const index = listeners.findIndex(l => l.id === listenerId);
      if (index !== -1) {
        const listener = listeners[index];
        listeners.splice(index, 1);
        
        // Clean up empty arrays
        if (listeners.length === 0) {
          this.eventListeners.delete(eventType);
        }

        // Update statistics
        this.stats.totalListeners--;
        this.stats.listenersByScope[listener.scope]--;

        // Emit unsubscription event
        super.emit('listener.unsubscribed', { listenerId, eventType });
        
        return true;
      }
    }
    return false;
  }

  /**
   * Unsubscribe all listeners for a specific scope
   */
  unsubscribeByScope(scope: EventScope, sessionId?: string, pluginName?: string): number {
    let removedCount = 0;

    for (const [eventType, listeners] of this.eventListeners.entries()) {
      const toRemove = listeners.filter(listener => {
        if (listener.scope !== scope) return false;
        if (sessionId && listener.sessionId !== sessionId) return false;
        if (pluginName && listener.pluginName !== pluginName) return false;
        return true;
      });

      // Remove matching listeners
      for (const listener of toRemove) {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
          removedCount++;
          this.stats.totalListeners--;
          this.stats.listenersByScope[listener.scope]--;
        }
      }

      // Clean up empty arrays
      if (listeners.length === 0) {
        this.eventListeners.delete(eventType);
      }
    }

    if (removedCount > 0) {
      super.emit('listeners.bulk.unsubscribed', { scope, sessionId, pluginName, count: removedCount });
    }

    return removedCount;
  }

  /**
   * Get event history with filtering
   */
  getEventHistory(options: {
    eventType?: string;
    scope?: EventScope;
    sessionId?: string;
    pluginName?: string;
    since?: number;
    limit?: number;
  } = {}): SystemEvent[] {
    let filtered = [...this.eventHistory];

    if (options.eventType) {
      filtered = filtered.filter(event => event.type === options.eventType);
    }

    if (options.scope) {
      filtered = filtered.filter(event => event.metadata.scope === options.scope);
    }

    if (options.sessionId) {
      filtered = filtered.filter(event => event.metadata.sessionId === options.sessionId);
    }

    if (options.pluginName) {
      filtered = filtered.filter(event => event.metadata.pluginName === options.pluginName);
    }

    if (options.since !== undefined) {
      filtered = filtered.filter(event => event.metadata.timestamp >= options.since!);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get current statistics
   */
  getStats(): EventStats {
    return { ...this.stats };
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
    super.emit('history.cleared');
  }

  /**
   * Get active listeners
   */
  getActiveListeners(): Map<string, EventListener[]> {
    return new Map(this.eventListeners);
  }

  /**
   * Private helper methods
   */

  private addToHistory(event: SystemEvent): void {
    this.eventHistory.push(event);
    
    // Maintain history size limit
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  private getMatchingListeners(event: SystemEvent): EventListener[] {
    const listeners = this.eventListeners.get(event.type) || [];
    
    return listeners.filter(listener => {
      // Check scope matching
      if (listener.scope === EventScope.SESSION && 
          listener.sessionId !== event.metadata.sessionId) {
        return false;
      }

      if (listener.scope === EventScope.PLUGIN && 
          listener.pluginName !== event.metadata.pluginName) {
        return false;
      }

      // Apply custom filter if provided
      if (listener.filter && !listener.filter(event)) {
        return false;
      }

      return true;
    });
  }

  private async processListener(listener: EventListener, event: SystemEvent): Promise<void> {
    try {
      await listener.handler(event);
    } catch (error) {
      console.error(`[EventSystem] Listener ${listener.id} failed for event ${event.type}:`, error);
      super.emit('listener.error', { listener, event, error });
      throw error; // Re-throw to be caught by Promise.allSettled
    }
  }

  private removeOnceListeners(processedListeners: EventListener[], event: SystemEvent): void {
    const onceListeners = processedListeners.filter(l => l.once);
    
    for (const listener of onceListeners) {
      this.unsubscribe(listener.id);
    }
  }
}

/**
 * Global event system instance
 */
export const globalEventSystem = new EventSystem();

/**
 * Convenience functions for common event operations
 */
export const events = {
  /**
   * Emit a global event
   */
  emit: <T>(eventType: string, data: T, options?: { priority?: EventPriority; tags?: string[] }) =>
    globalEventSystem.emitEvent(eventType, data, { scope: EventScope.GLOBAL, ...options }),

  /**
   * Emit a session-scoped event
   */
  emitSession: <T>(eventType: string, data: T, sessionId: string, options?: { priority?: EventPriority; tags?: string[] }) =>
    globalEventSystem.emitEvent(eventType, data, { scope: EventScope.SESSION, sessionId, ...options }),

  /**
   * Emit a plugin-scoped event
   */
  emitPlugin: <T>(eventType: string, data: T, pluginName: string, options?: { priority?: EventPriority; tags?: string[] }) =>
    globalEventSystem.emitEvent(eventType, data, { scope: EventScope.PLUGIN, pluginName, ...options }),

  /**
   * Subscribe to global events
   */
  on: (eventType: string, handler: (event: SystemEvent) => Promise<void> | void, options?: { priority?: EventPriority; filter?: (event: SystemEvent) => boolean }) =>
    globalEventSystem.subscribe(eventType, handler, { scope: EventScope.GLOBAL, ...options }),

  /**
   * Subscribe to session events
   */
  onSession: (eventType: string, sessionId: string, handler: (event: SystemEvent) => Promise<void> | void, options?: { priority?: EventPriority; filter?: (event: SystemEvent) => boolean }) =>
    globalEventSystem.subscribe(eventType, handler, { scope: EventScope.SESSION, sessionId, ...options }),

  /**
   * Subscribe to plugin events
   */
  onPlugin: (eventType: string, pluginName: string, handler: (event: SystemEvent) => Promise<void> | void, options?: { priority?: EventPriority; filter?: (event: SystemEvent) => boolean }) =>
    globalEventSystem.subscribe(eventType, handler, { scope: EventScope.PLUGIN, pluginName, ...options }),

  /**
   * Subscribe once to an event
   */
  once: (eventType: string, handler: (event: SystemEvent) => Promise<void> | void, options?: { scope?: EventScope; sessionId?: string; pluginName?: string }) =>
    globalEventSystem.subscribe(eventType, handler, { once: true, ...options }),

  /**
   * Get event history
   */
  history: (options?: { eventType?: string; scope?: EventScope; sessionId?: string; pluginName?: string; since?: number; limit?: number }) =>
    globalEventSystem.getEventHistory(options),

  /**
   * Get statistics
   */
  stats: () => globalEventSystem.getStats(),

  /**
   * Clean up session events
   */
  cleanupSession: (sessionId: string) =>
    globalEventSystem.unsubscribeByScope(EventScope.SESSION, sessionId),

  /**
   * Clean up plugin events
   */
  cleanupPlugin: (pluginName: string) =>
    globalEventSystem.unsubscribeByScope(EventScope.PLUGIN, undefined, pluginName)
};