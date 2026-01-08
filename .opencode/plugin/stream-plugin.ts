/**
 * Stream Plugin for OpenCode
 * Provides real-time response streaming capabilities
 * 
 * This plugin implements streaming functionality including:
 * - Real-time response streaming
 * - Server-Sent Events (SSE) support
 * - Stream management and lifecycle
 * - Backpressure handling
 * - Stream multiplexing
 * 
 * Requirements: 10.5
 */

import { EventEmitter } from 'node:events';
import { StandardToolResult, ErrorCode, createSuccessResult, createErrorResult } from './types';

/**
 * Stream types supported by the plugin
 */
export enum StreamType {
  TEXT = 'text',
  JSON = 'json',
  BINARY = 'binary',
  EVENT = 'event'
}

/**
 * Stream event types
 */
export enum StreamEventType {
  DATA = 'data',
  ERROR = 'error',
  END = 'end',
  CLOSE = 'close',
  DRAIN = 'drain'
}

/**
 * Stream configuration options
 */
export interface StreamOptions {
  type: StreamType;
  encoding?: BufferEncoding;
  highWaterMark?: number;
  objectMode?: boolean;
  autoClose?: boolean;
  keepAlive?: boolean;
  timeout?: number;
  maxListeners?: number;
}

/**
 * Stream metadata
 */
export interface StreamMetadata {
  id: string;
  type: StreamType;
  created: number;
  lastActivity: number;
  bytesWritten: number;
  bytesRead: number;
  isActive: boolean;
  isPaused: boolean;
  hasEnded: boolean;
  listenerCount: number;
}

/**
 * Server-Sent Event data structure
 */
export interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

/**
 * Stream chunk data
 */
export interface StreamChunk {
  id: string;
  sequence: number;
  data: any;
  timestamp: number;
  type: StreamType;
  isLast?: boolean;
}

/**
 * Stream statistics
 */
export interface StreamStats {
  totalStreams: number;
  activeStreams: number;
  totalBytesTransferred: number;
  averageStreamDuration: number;
  errorRate: number;
}

/**
 * Managed stream wrapper
 */
export class ManagedStream extends EventEmitter {
  public readonly id: string;
  public readonly type: StreamType;
  public readonly created: number;
  private options: StreamOptions;
  private bytesWritten: number = 0;
  private bytesRead: number = 0;
  private lastActivity: number;
  private isActive: boolean = true;
  private isPaused: boolean = false;
  private hasEnded: boolean = false;
  private sequence: number = 0;
  private timeoutHandle?: NodeJS.Timeout;

  constructor(id: string, options: StreamOptions) {
    super();
    this.id = id;
    this.type = options.type;
    this.options = options;
    this.created = Date.now();
    this.lastActivity = this.created;

    // Set max listeners if specified
    if (options.maxListeners) {
      this.setMaxListeners(options.maxListeners);
    }

    // Set up timeout if specified
    if (options.timeout) {
      this.setupTimeout();
    }

    // Handle backpressure
    this.on('drain', () => {
      this.emit(StreamEventType.DRAIN);
    });
  }

  /**
   * Write data to the stream
   */
  write(data: any): boolean {
    if (this.hasEnded) {
      this.emit('error', new Error('Cannot write to ended stream'));
      return false;
    }

    if (this.isPaused) {
      this.emit('error', new Error('Cannot write to paused stream'));
      return false;
    }

    try {
      const chunk: StreamChunk = {
        id: this.id,
        sequence: this.sequence++,
        data,
        timestamp: Date.now(),
        type: this.type
      };

      // Update statistics
      this.bytesWritten += this.calculateDataSize(data);
      this.lastActivity = Date.now();

      // Emit data event
      this.emit(StreamEventType.DATA, chunk);

      // Reset timeout
      if (this.options.timeout) {
        this.setupTimeout();
      }

      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  /**
   * End the stream
   */
  end(finalData?: any): void {
    if (this.hasEnded) {
      return;
    }

    try {
      // Write final data if provided
      if (finalData !== undefined) {
        const chunk: StreamChunk = {
          id: this.id,
          sequence: this.sequence++,
          data: finalData,
          timestamp: Date.now(),
          type: this.type,
          isLast: true
        };

        this.bytesWritten += this.calculateDataSize(finalData);
        this.emit(StreamEventType.DATA, chunk);
      }

      // Mark as ended
      this.hasEnded = true;
      this.isActive = false;
      this.lastActivity = Date.now();

      // Clear timeout
      if (this.timeoutHandle) {
        clearTimeout(this.timeoutHandle);
      }

      // Emit end event
      this.emit(StreamEventType.END);

      // Auto-close if configured
      if (this.options.autoClose !== false) {
        this.close();
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Pause the stream
   */
  pause(): void {
    this.isPaused = true;
    this.lastActivity = Date.now();
  }

  /**
   * Resume the stream
   */
  resume(): void {
    this.isPaused = false;
    this.lastActivity = Date.now();
  }

  /**
   * Close the stream
   */
  close(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    this.lastActivity = Date.now();

    // Clear timeout
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }

    // Emit close event
    this.emit(StreamEventType.CLOSE);

    // Remove all listeners
    this.removeAllListeners();
  }

  /**
   * Get stream metadata
   */
  getMetadata(): StreamMetadata {
    return {
      id: this.id,
      type: this.type,
      created: this.created,
      lastActivity: this.lastActivity,
      bytesWritten: this.bytesWritten,
      bytesRead: this.bytesRead,
      isActive: this.isActive,
      isPaused: this.isPaused,
      hasEnded: this.hasEnded,
      listenerCount: this.listenerCount('data')
    };
  }

  /**
   * Setup timeout handling
   */
  private setupTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }

    if (this.options.timeout) {
      this.timeoutHandle = setTimeout(() => {
        this.emit('error', new Error(`Stream timeout after ${this.options.timeout}ms`));
        this.close();
      }, this.options.timeout);
    }
  }

  /**
   * Calculate data size for statistics
   */
  private calculateDataSize(data: any): number {
    if (typeof data === 'string') {
      return Buffer.byteLength(data, 'utf8');
    } else if (Buffer.isBuffer(data)) {
      return data.length;
    } else if (typeof data === 'object') {
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    } else {
      return Buffer.byteLength(String(data), 'utf8');
    }
  }
}

/**
 * Server-Sent Events formatter
 */
export class SSEFormatter {
  /**
   * Format data as Server-Sent Event
   */
  static formatEvent(event: SSEEvent): string {
    let formatted = '';

    if (event.id) {
      formatted += `id: ${event.id}\n`;
    }

    if (event.event) {
      formatted += `event: ${event.event}\n`;
    }

    if (event.retry) {
      formatted += `retry: ${event.retry}\n`;
    }

    // Handle multi-line data
    const dataLines = event.data.split('\n');
    for (const line of dataLines) {
      formatted += `data: ${line}\n`;
    }

    formatted += '\n';
    return formatted;
  }

  /**
   * Format stream chunk as SSE
   */
  static formatChunk(chunk: StreamChunk): string {
    const event: SSEEvent = {
      id: `${chunk.id}-${chunk.sequence}`,
      event: chunk.isLast ? 'end' : 'data',
      data: typeof chunk.data === 'string' ? chunk.data : JSON.stringify(chunk.data)
    };

    return this.formatEvent(event);
  }

  /**
   * Format error as SSE
   */
  static formatError(error: Error, streamId?: string): string {
    const event: SSEEvent = {
      id: streamId ? `${streamId}-error` : 'error',
      event: 'error',
      data: JSON.stringify({
        message: error.message,
        name: error.name,
        timestamp: Date.now()
      })
    };

    return this.formatEvent(event);
  }
}

/**
 * Stream manager for handling multiple streams
 */
export class StreamManager {
  private streams: Map<string, ManagedStream> = new Map();
  private stats: StreamStats = {
    totalStreams: 0,
    activeStreams: 0,
    totalBytesTransferred: 0,
    averageStreamDuration: 0,
    errorRate: 0
  };
  private streamDurations: number[] = [];
  private errorCount: number = 0;

  /**
   * Create a new managed stream
   */
  createStream(id: string, options: StreamOptions): StandardToolResult<ManagedStream> {
    try {
      if (this.streams.has(id)) {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Stream with id '${id}' already exists`,
          { streamId: id }
        );
      }

      const stream = new ManagedStream(id, options);

      // Set up event handlers
      stream.on(StreamEventType.END, () => {
        this.handleStreamEnd(stream);
      });

      stream.on(StreamEventType.CLOSE, () => {
        this.handleStreamClose(stream);
      });

      stream.on(StreamEventType.ERROR, (error) => {
        this.handleStreamError(stream, error);
      });

      // Register stream
      this.streams.set(id, stream);
      this.stats.totalStreams++;
      this.stats.activeStreams++;

      return createSuccessResult(stream);
    } catch (error) {
      return createErrorResult(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to create stream: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { streamId: id, options, error }
      );
    }
  }

  /**
   * Get a stream by ID
   */
  getStream(id: string): ManagedStream | undefined {
    return this.streams.get(id);
  }

  /**
   * Get all active streams
   */
  getActiveStreams(): ManagedStream[] {
    return Array.from(this.streams.values()).filter(stream => stream.getMetadata().isActive);
  }

  /**
   * Get stream statistics
   */
  getStats(): StreamStats {
    // Update active streams count
    this.stats.activeStreams = this.getActiveStreams().length;
    
    // Calculate average duration
    if (this.streamDurations.length > 0) {
      this.stats.averageStreamDuration = this.streamDurations.reduce((a, b) => a + b, 0) / this.streamDurations.length;
    }

    // Calculate error rate
    this.stats.errorRate = this.stats.totalStreams > 0 ? this.errorCount / this.stats.totalStreams : 0;

    return { ...this.stats };
  }

  /**
   * Close a stream
   */
  closeStream(id: string): StandardToolResult<void> {
    try {
      const stream = this.streams.get(id);
      if (!stream) {
        return createErrorResult(
          ErrorCode.VALIDATION_ERROR,
          `Stream with id '${id}' not found`,
          { streamId: id }
        );
      }

      stream.close();
      return createSuccessResult(undefined);
    } catch (error) {
      return createErrorResult(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to close stream: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { streamId: id, error }
      );
    }
  }

  /**
   * Close all streams
   */
  closeAllStreams(): StandardToolResult<{ closed: number }> {
    try {
      let closedCount = 0;
      
      for (const stream of this.streams.values()) {
        if (stream.getMetadata().isActive) {
          stream.close();
          closedCount++;
        }
      }

      return createSuccessResult({ closed: closedCount });
    } catch (error) {
      return createErrorResult(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to close all streams: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error }
      );
    }
  }

  /**
   * Clean up inactive streams
   */
  cleanup(maxAge: number = 300000): StandardToolResult<{ cleaned: number }> { // 5 minutes default
    try {
      let cleanedCount = 0;
      const now = Date.now();

      for (const [id, stream] of this.streams.entries()) {
        const metadata = stream.getMetadata();
        
        if (!metadata.isActive && (now - metadata.lastActivity) > maxAge) {
          this.streams.delete(id);
          cleanedCount++;
        }
      }

      return createSuccessResult({ cleaned: cleanedCount });
    } catch (error) {
      return createErrorResult(
        ErrorCode.UNKNOWN_ERROR,
        `Failed to cleanup streams: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { maxAge, error }
      );
    }
  }

  /**
   * Handle stream end event
   */
  private handleStreamEnd(stream: ManagedStream): void {
    const metadata = stream.getMetadata();
    const duration = Date.now() - metadata.created;
    this.streamDurations.push(duration);
    this.stats.totalBytesTransferred += metadata.bytesWritten;
  }

  /**
   * Handle stream close event
   */
  private handleStreamClose(stream: ManagedStream): void {
    this.stats.activeStreams = Math.max(0, this.stats.activeStreams - 1);
  }

  /**
   * Handle stream error event
   */
  private handleStreamError(stream: ManagedStream, error: Error): void {
    this.errorCount++;
    console.error(`Stream ${stream.id} error:`, error);
  }
}

/**
 * Stream Plugin
 */
export const streamPlugin = async ({ client, $, directory }: any) => {
  const streamManager = new StreamManager();

  return {
    tools: {
      create_stream: {
        description: "Create a new managed stream for real-time data transmission",
        parameters: {
          type: "object",
          properties: {
            streamId: {
              type: "string",
              description: "Unique identifier for the stream"
            },
            type: {
              type: "string",
              enum: ["text", "json", "binary", "event"],
              description: "Type of data the stream will handle",
              default: "text"
            },
            encoding: {
              type: "string",
              description: "Text encoding for the stream",
              default: "utf8"
            },
            timeout: {
              type: "number",
              description: "Stream timeout in milliseconds",
              minimum: 1000
            },
            autoClose: {
              type: "boolean",
              description: "Whether to automatically close the stream when ended",
              default: true
            },
            keepAlive: {
              type: "boolean",
              description: "Whether to keep the stream connection alive",
              default: false
            }
          },
          required: ["streamId"]
        },
        handler: async ({ streamId, type, encoding, timeout, autoClose, keepAlive }: {
          streamId: string;
          type?: StreamType;
          encoding?: BufferEncoding;
          timeout?: number;
          autoClose?: boolean;
          keepAlive?: boolean;
        }) => {
          const options: StreamOptions = {
            type: type || StreamType.TEXT,
            encoding: encoding || 'utf8',
            timeout,
            autoClose: autoClose !== false,
            keepAlive: keepAlive || false
          };

          const result = streamManager.createStream(streamId, options);
          
          if (result.success) {
            const metadata = result.data!.getMetadata();
            return createSuccessResult({
              streamId,
              metadata,
              message: 'Stream created successfully'
            });
          }

          return result;
        }
      },

      write_to_stream: {
        description: "Write data to an existing stream",
        parameters: {
          type: "object",
          properties: {
            streamId: {
              type: "string",
              description: "ID of the stream to write to"
            },
            data: {
              description: "Data to write to the stream (string, object, or buffer)"
            },
            asSSE: {
              type: "boolean",
              description: "Whether to format the data as Server-Sent Events",
              default: false
            }
          },
          required: ["streamId", "data"]
        },
        handler: async ({ streamId, data, asSSE }: {
          streamId: string;
          data: any;
          asSSE?: boolean;
        }) => {
          const startTime = Date.now();

          try {
            const stream = streamManager.getStream(streamId);
            if (!stream) {
              return createErrorResult(
                ErrorCode.VALIDATION_ERROR,
                `Stream '${streamId}' not found`,
                { streamId }
              );
            }

            let writeData = data;
            
            // Format as SSE if requested
            if (asSSE) {
              const chunk: StreamChunk = {
                id: streamId,
                sequence: 0, // Will be set by stream
                data,
                timestamp: Date.now(),
                type: stream.type
              };
              writeData = SSEFormatter.formatChunk(chunk);
            }

            const success = stream.write(writeData);
            
            return createSuccessResult(
              {
                streamId,
                success,
                metadata: stream.getMetadata()
              },
              { duration: Date.now() - startTime }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.UNKNOWN_ERROR,
              `Failed to write to stream: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { streamId, data, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      end_stream: {
        description: "End a stream, optionally with final data",
        parameters: {
          type: "object",
          properties: {
            streamId: {
              type: "string",
              description: "ID of the stream to end"
            },
            finalData: {
              description: "Optional final data to write before ending the stream"
            }
          },
          required: ["streamId"]
        },
        handler: async ({ streamId, finalData }: {
          streamId: string;
          finalData?: any;
        }) => {
          const startTime = Date.now();

          try {
            const stream = streamManager.getStream(streamId);
            if (!stream) {
              return createErrorResult(
                ErrorCode.VALIDATION_ERROR,
                `Stream '${streamId}' not found`,
                { streamId }
              );
            }

            stream.end(finalData);
            
            return createSuccessResult(
              {
                streamId,
                metadata: stream.getMetadata(),
                message: 'Stream ended successfully'
              },
              { duration: Date.now() - startTime }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.UNKNOWN_ERROR,
              `Failed to end stream: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { streamId, finalData, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      get_stream_info: {
        description: "Get information about a specific stream",
        parameters: {
          type: "object",
          properties: {
            streamId: {
              type: "string",
              description: "ID of the stream to get information about"
            }
          },
          required: ["streamId"]
        },
        handler: async ({ streamId }: { streamId: string }) => {
          const startTime = Date.now();

          try {
            const stream = streamManager.getStream(streamId);
            if (!stream) {
              return createErrorResult(
                ErrorCode.VALIDATION_ERROR,
                `Stream '${streamId}' not found`,
                { streamId }
              );
            }

            const metadata = stream.getMetadata();
            
            return createSuccessResult(
              {
                streamId,
                metadata,
                age: Date.now() - metadata.created,
                timeSinceLastActivity: Date.now() - metadata.lastActivity
              },
              { duration: Date.now() - startTime }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.UNKNOWN_ERROR,
              `Failed to get stream info: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { streamId, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      list_streams: {
        description: "List all streams with their current status",
        parameters: {
          type: "object",
          properties: {
            activeOnly: {
              type: "boolean",
              description: "Whether to list only active streams",
              default: false
            }
          },
          required: []
        },
        handler: async ({ activeOnly }: { activeOnly?: boolean }) => {
          const startTime = Date.now();

          try {
            let streams: ManagedStream[];
            
            if (activeOnly) {
              streams = streamManager.getActiveStreams();
            } else {
              streams = Array.from(streamManager['streams'].values());
            }

            const streamList = streams.map(stream => stream.getMetadata());
            const stats = streamManager.getStats();

            return createSuccessResult(
              {
                streams: streamList,
                stats,
                total: streamList.length
              },
              { duration: Date.now() - startTime }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.UNKNOWN_ERROR,
              `Failed to list streams: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { activeOnly, error },
              { duration: Date.now() - startTime }
            );
          }
        }
      },

      close_stream: {
        description: "Close a specific stream",
        parameters: {
          type: "object",
          properties: {
            streamId: {
              type: "string",
              description: "ID of the stream to close"
            }
          },
          required: ["streamId"]
        },
        handler: async ({ streamId }: { streamId: string }) => {
          return streamManager.closeStream(streamId);
        }
      },

      cleanup_streams: {
        description: "Clean up inactive streams older than specified age",
        parameters: {
          type: "object",
          properties: {
            maxAge: {
              type: "number",
              description: "Maximum age in milliseconds for inactive streams",
              default: 300000,
              minimum: 60000
            }
          },
          required: []
        },
        handler: async ({ maxAge }: { maxAge?: number }) => {
          return streamManager.cleanup(maxAge);
        }
      },

      get_stream_stats: {
        description: "Get overall streaming statistics",
        parameters: {
          type: "object",
          properties: {},
          required: []
        },
        handler: async () => {
          const startTime = Date.now();

          try {
            const stats = streamManager.getStats();
            
            return createSuccessResult(
              stats,
              { duration: Date.now() - startTime }
            );
          } catch (error) {
            return createErrorResult(
              ErrorCode.UNKNOWN_ERROR,
              `Failed to get stream stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { error },
              { duration: Date.now() - startTime }
            );
          }
        }
      }
    },

    // Expose stream manager for other plugins
    streamManager,
    
    // Expose SSE formatter for other plugins
    SSEFormatter
  };
};

export default streamPlugin;