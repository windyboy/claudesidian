/**
 * Memory Management Plugin for OpenCode
 * Provides persistent memory across sessions using Memvid MCP integration
 * 
 * This plugin implements memory management functionality including:
 * - Memvid MCP integration
 * - Automatic context storage
 * - Session memory management
 * - Historical context retrieval
 * 
 * Requirements: 5.1, 5.6, 5.7
 */

import { promises as fs } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { 
  StandardToolResult, 
  ErrorCode, 
  createSuccessResult, 
  createErrorResult,
  Session,
  SessionCreatedContext,
  SessionCompactionContext,
  Part,
  ToolExecutionResultContext
} from './types';

/**
 * Memory file configuration
 */
interface MemoryConfig {
  projectMemoryFile: string;
  sessionMemoryPattern: string;
  contextMemoryFile: string;
  maxMemorySize: number; // in MB
  autoCommitInterval: number; // in milliseconds
}

/**
 * Memory entry metadata
 */
interface MemoryEntry {
  id: string;
  type: 'conversation' | 'tool_result' | 'decision' | 'plan' | 'context';
  content: string;
  title?: string;
  tags: Record<string, string>;
  timestamp: number;
  sessionId?: string;
}

/**
 * Memory storage interface for Memvid integration
 */
interface MemoryStorage {
  createMemoryFile(filePath: string, description?: string): Promise<StandardToolResult<void>>;
  addContent(filePath: string, entry: MemoryEntry): Promise<StandardToolResult<string>>;
  searchMemory(filePath: string, query: string, topK?: number): Promise<StandardToolResult<any[]>>;
  commitChanges(filePath: string): Promise<StandardToolResult<void>>;
  getMemoryInfo(filePath: string): Promise<StandardToolResult<any>>;
}

/**
 * Memvid MCP client wrapper
 */
export class MemvidClient implements MemoryStorage {
  private mcpClient: any;

  constructor(mcpClient: any) {
    this.mcpClient = mcpClient;
  }

  /**
   * Create a new memory file
   */
  async createMemoryFile(filePath: string, description?: string): Promise<StandardToolResult<void>> {
    const startTime = Date.now();
    
    try {
      // Check if file already exists
      try {
        await fs.access(filePath);
        return createSuccessResult(undefined, {
          duration: Date.now() - startTime,
          warnings: [`Memory file ${filePath} already exists`]
        });
      } catch {
        // File doesn't exist, create it
      }

      // Create directory if needed
      const dir = dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Use Memvid MCP to create memory file
      const result = await this.mcpClient.request('mcp_memvid_memvid_create', {
        file_path: filePath,
        description: description || `Memory file created at ${new Date().toISOString()}`
      });

      if (!result.success) {
        return createErrorResult(
          ErrorCode.STORAGE_ERROR,
          `Failed to create memory file: ${result.error?.message || 'Unknown error'}`,
          { filePath, result },
          { duration: Date.now() - startTime }
        );
      }

      return createSuccessResult(undefined, {
        duration: Date.now() - startTime
      });
    } catch (error) {
      return createErrorResult(
        ErrorCode.STORAGE_ERROR,
        `Memory file creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filePath, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Add content to memory file
   */
  async addContent(filePath: string, entry: MemoryEntry): Promise<StandardToolResult<string>> {
    const startTime = Date.now();
    
    try {
      // Use Memvid MCP to add content
      const result = await this.mcpClient.request('mcp_memvid_memvid_add_text', {
        file_path: filePath,
        content: entry.content,
        title: entry.title || `${entry.type} - ${new Date(entry.timestamp).toISOString()}`,
        tags: {
          ...entry.tags,
          type: entry.type,
          timestamp: entry.timestamp.toString(),
          id: entry.id,
          ...(entry.sessionId && { sessionId: entry.sessionId })
        }
      });

      if (!result.success) {
        return createErrorResult(
          ErrorCode.STORAGE_ERROR,
          `Failed to add content to memory: ${result.error?.message || 'Unknown error'}`,
          { filePath, entry, result },
          { duration: Date.now() - startTime }
        );
      }

      return createSuccessResult(entry.id, {
        duration: Date.now() - startTime
      });
    } catch (error) {
      return createErrorResult(
        ErrorCode.STORAGE_ERROR,
        `Memory content addition failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filePath, entry, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Search memory content
   */
  async searchMemory(filePath: string, query: string, topK: number = 5): Promise<StandardToolResult<any[]>> {
    const startTime = Date.now();
    
    try {
      // Use Memvid MCP to search
      const result = await this.mcpClient.request('mcp_memvid_memvid_search', {
        file_path: filePath,
        query,
        top_k: topK,
        snippet_chars: 200
      });

      if (!result.success) {
        return createErrorResult(
          ErrorCode.RETRIEVAL_ERROR,
          `Failed to search memory: ${result.error?.message || 'Unknown error'}`,
          { filePath, query, result },
          { duration: Date.now() - startTime }
        );
      }

      return createSuccessResult(result.data || [], {
        duration: Date.now() - startTime
      });
    } catch (error) {
      return createErrorResult(
        ErrorCode.RETRIEVAL_ERROR,
        `Memory search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filePath, query, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Commit changes to memory file
   */
  async commitChanges(filePath: string): Promise<StandardToolResult<void>> {
    const startTime = Date.now();
    
    try {
      // Use Memvid MCP to commit
      const result = await this.mcpClient.request('mcp_memvid_memvid_commit', {
        file_path: filePath
      });

      if (!result.success) {
        return createErrorResult(
          ErrorCode.STORAGE_ERROR,
          `Failed to commit memory changes: ${result.error?.message || 'Unknown error'}`,
          { filePath, result },
          { duration: Date.now() - startTime }
        );
      }

      return createSuccessResult(undefined, {
        duration: Date.now() - startTime
      });
    } catch (error) {
      return createErrorResult(
        ErrorCode.STORAGE_ERROR,
        `Memory commit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filePath, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Get memory file information
   */
  async getMemoryInfo(filePath: string): Promise<StandardToolResult<any>> {
    const startTime = Date.now();
    
    try {
      // Use Memvid MCP to get info
      const result = await this.mcpClient.request('mcp_memvid_memvid_info', {
        file_path: filePath
      });

      if (!result.success) {
        return createErrorResult(
          ErrorCode.RETRIEVAL_ERROR,
          `Failed to get memory info: ${result.error?.message || 'Unknown error'}`,
          { filePath, result },
          { duration: Date.now() - startTime }
        );
      }

      return createSuccessResult(result.data, {
        duration: Date.now() - startTime
      });
    } catch (error) {
      return createErrorResult(
        ErrorCode.RETRIEVAL_ERROR,
        `Memory info retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { filePath, error },
        { duration: Date.now() - startTime }
      );
    }
  }
}

/**
 * Session memory manager
 */
export class SessionMemoryManager {
  private memoryStorage: MemoryStorage;
  private config: MemoryConfig;
  private autoCommitTimer: NodeJS.Timeout | null = null;
  private pendingCommits: Set<string> = new Set();

  constructor(memoryStorage: MemoryStorage, config: MemoryConfig) {
    this.memoryStorage = memoryStorage;
    this.config = config;
    this.startAutoCommit();
  }

  /**
   * Initialize memory files for a session
   */
  async initializeSessionMemory(session: Session): Promise<StandardToolResult<{ projectFile: string; sessionFile: string }>> {
    const startTime = Date.now();
    
    try {
      // Generate file paths
      const projectFile = resolve(session.directory, this.config.projectMemoryFile);
      const sessionDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const sessionFile = resolve(session.directory, this.config.sessionMemoryPattern.replace('{date}', sessionDate));

      // Create project memory file if it doesn't exist
      const projectResult = await this.memoryStorage.createMemoryFile(
        projectFile,
        `Project memory for ${session.directory}`
      );

      if (!projectResult.success) {
        return createErrorResult(
          projectResult.error!.code,
          projectResult.error!.message,
          projectResult.error!.details,
          { duration: Date.now() - startTime }
        );
      }

      // Create session memory file
      const sessionResult = await this.memoryStorage.createMemoryFile(
        sessionFile,
        `Session memory for ${sessionDate} in ${session.directory}`
      );

      if (!sessionResult.success) {
        return createErrorResult(
          sessionResult.error!.code,
          sessionResult.error!.message,
          sessionResult.error!.details,
          { duration: Date.now() - startTime }
        );
      }

      return createSuccessResult(
        { projectFile, sessionFile },
        { duration: Date.now() - startTime }
      );
    } catch (error) {
      return createErrorResult(
        ErrorCode.STORAGE_ERROR,
        `Session memory initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { session, error },
        { duration: Date.now() - startTime }
      );
    }
  }

  /**
   * Store conversation in memory
   */
  async storeConversation(
    filePath: string,
    content: string,
    sessionId: string,
    metadata?: Record<string, string>
  ): Promise<StandardToolResult<string>> {
    const entry: MemoryEntry = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'conversation',
      content,
      title: `Conversation - ${new Date().toISOString()}`,
      tags: {
        ...metadata,
        topic: metadata?.topic || 'general',
        status: metadata?.status || 'active'
      },
      timestamp: Date.now(),
      sessionId
    };

    const result = await this.memoryStorage.addContent(filePath, entry);
    
    if (result.success) {
      this.scheduleCommit(filePath);
    }
    
    return result;
  }

  /**
   * Store tool result in memory
   */
  async storeToolResult(
    filePath: string,
    toolName: string,
    input: any,
    result: any,
    sessionId: string,
    metadata?: Record<string, string>
  ): Promise<StandardToolResult<string>> {
    const content = JSON.stringify({
      tool: toolName,
      input,
      result,
      timestamp: new Date().toISOString()
    }, null, 2);

    const entry: MemoryEntry = {
      id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'tool_result',
      content,
      title: `Tool Result: ${toolName}`,
      tags: {
        ...metadata,
        tool: toolName,
        status: result.success ? 'success' : 'error',
        topic: metadata?.topic || 'tool-execution'
      },
      timestamp: Date.now(),
      sessionId
    };

    const storeResult = await this.memoryStorage.addContent(filePath, entry);
    
    if (storeResult.success) {
      this.scheduleCommit(filePath);
    }
    
    return storeResult;
  }

  /**
   * Store decision or plan in memory
   */
  async storeDecision(
    filePath: string,
    decision: string,
    context: string,
    sessionId: string,
    metadata?: Record<string, string>
  ): Promise<StandardToolResult<string>> {
    const content = `## Decision\n\n${decision}\n\n## Context\n\n${context}`;

    const entry: MemoryEntry = {
      id: `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'decision',
      content,
      title: `Decision - ${new Date().toISOString()}`,
      tags: {
        ...metadata,
        priority: metadata?.priority || 'medium',
        status: metadata?.status || 'active',
        topic: metadata?.topic || 'decision'
      },
      timestamp: Date.now(),
      sessionId
    };

    const result = await this.memoryStorage.addContent(filePath, entry);
    
    if (result.success) {
      this.scheduleCommit(filePath);
    }
    
    return result;
  }

  /**
   * Retrieve relevant historical context
   */
  async getRelevantContext(
    filePath: string,
    query: string,
    maxResults: number = 5
  ): Promise<StandardToolResult<any[]>> {
    return await this.memoryStorage.searchMemory(filePath, query, maxResults);
  }

  /**
   * Schedule a commit for a memory file
   */
  private scheduleCommit(filePath: string): void {
    this.pendingCommits.add(filePath);
  }

  /**
   * Start auto-commit timer
   */
  private startAutoCommit(): void {
    if (this.autoCommitTimer) {
      clearInterval(this.autoCommitTimer);
    }

    this.autoCommitTimer = setInterval(async () => {
      const filesToCommit = Array.from(this.pendingCommits);
      this.pendingCommits.clear();

      for (const filePath of filesToCommit) {
        try {
          await this.memoryStorage.commitChanges(filePath);
        } catch (error) {
          console.warn(`Failed to auto-commit memory file ${filePath}:`, error);
          // Re-add to pending commits for retry
          this.pendingCommits.add(filePath);
        }
      }
    }, this.config.autoCommitInterval);
  }

  /**
   * Stop auto-commit timer
   */
  stopAutoCommit(): void {
    if (this.autoCommitTimer) {
      clearInterval(this.autoCommitTimer);
      this.autoCommitTimer = null;
    }
  }

  /**
   * Force commit all pending changes
   */
  async commitAll(): Promise<StandardToolResult<string[]>> {
    const startTime = Date.now();
    const filesToCommit = Array.from(this.pendingCommits);
    const committed: string[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const filePath of filesToCommit) {
      try {
        const result = await this.memoryStorage.commitChanges(filePath);
        if (result.success) {
          committed.push(filePath);
          this.pendingCommits.delete(filePath);
        } else {
          errors.push({
            file: filePath,
            error: result.error?.message || 'Unknown error'
          });
        }
      } catch (error) {
        errors.push({
          file: filePath,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (errors.length > 0) {
      return createErrorResult(
        ErrorCode.STORAGE_ERROR,
        `Failed to commit ${errors.length} memory files`,
        { errors, committed },
        { duration: Date.now() - startTime }
      );
    }

    return createSuccessResult(committed, {
      duration: Date.now() - startTime
    });
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(filePath: string): Promise<StandardToolResult<any>> {
    return await this.memoryStorage.getMemoryInfo(filePath);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAutoCommit();
    this.pendingCommits.clear();
  }
}

/**
 * Memory Management Plugin
 */
export const memoryManagementPlugin = async ({ client, $, directory }: any) => {
  // Default configuration
  const config: MemoryConfig = {
    projectMemoryFile: 'opendian.mv2',
    sessionMemoryPattern: 'session-{date}.mv2',
    contextMemoryFile: 'context-current.mv2',
    maxMemorySize: 100, // 100MB
    autoCommitInterval: 30000 // 30 seconds
  };

  // Initialize Memvid client (assuming MCP client is available)
  const memvidClient = new MemvidClient(client);
  const sessionManager = new SessionMemoryManager(memvidClient, config);

  return {
    tools: {
      memory_create_file: {
        description: "Create a new memory file for storing context and conversations",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the memory file to create"
            },
            description: {
              type: "string",
              description: "Description of the memory file purpose"
            }
          },
          required: ["filePath"]
        },
        handler: async ({ filePath, description }: { filePath: string; description?: string }) => {
          return await memvidClient.createMemoryFile(filePath, description);
        }
      },

      memory_store_conversation: {
        description: "Store a conversation in memory with metadata",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the memory file"
            },
            content: {
              type: "string",
              description: "Conversation content to store"
            },
            sessionId: {
              type: "string",
              description: "Session ID for the conversation"
            },
            metadata: {
              type: "object",
              description: "Additional metadata tags",
              additionalProperties: {
                type: "string"
              }
            }
          },
          required: ["filePath", "content", "sessionId"]
        },
        handler: async ({ filePath, content, sessionId, metadata }: { 
          filePath: string; 
          content: string; 
          sessionId: string; 
          metadata?: Record<string, string> 
        }) => {
          return await sessionManager.storeConversation(filePath, content, sessionId, metadata);
        }
      },

      memory_store_tool_result: {
        description: "Store a tool execution result in memory",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the memory file"
            },
            toolName: {
              type: "string",
              description: "Name of the tool that was executed"
            },
            input: {
              type: "object",
              description: "Input parameters that were passed to the tool"
            },
            result: {
              type: "object",
              description: "Result returned by the tool"
            },
            sessionId: {
              type: "string",
              description: "Session ID for the tool execution"
            },
            metadata: {
              type: "object",
              description: "Additional metadata tags",
              additionalProperties: {
                type: "string"
              }
            }
          },
          required: ["filePath", "toolName", "input", "result", "sessionId"]
        },
        handler: async ({ filePath, toolName, input, result, sessionId, metadata }: {
          filePath: string;
          toolName: string;
          input: any;
          result: any;
          sessionId: string;
          metadata?: Record<string, string>;
        }) => {
          return await sessionManager.storeToolResult(filePath, toolName, input, result, sessionId, metadata);
        }
      },

      memory_store_decision: {
        description: "Store a decision or plan in memory with context",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the memory file"
            },
            decision: {
              type: "string",
              description: "The decision or plan content"
            },
            context: {
              type: "string",
              description: "Context and reasoning for the decision"
            },
            sessionId: {
              type: "string",
              description: "Session ID for the decision"
            },
            metadata: {
              type: "object",
              description: "Additional metadata tags",
              additionalProperties: {
                type: "string"
              }
            }
          },
          required: ["filePath", "decision", "context", "sessionId"]
        },
        handler: async ({ filePath, decision, context, sessionId, metadata }: {
          filePath: string;
          decision: string;
          context: string;
          sessionId: string;
          metadata?: Record<string, string>;
        }) => {
          return await sessionManager.storeDecision(filePath, decision, context, sessionId, metadata);
        }
      },

      memory_search: {
        description: "Search memory for relevant historical context",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the memory file to search"
            },
            query: {
              type: "string",
              description: "Search query"
            },
            maxResults: {
              type: "number",
              description: "Maximum number of results to return",
              default: 5
            }
          },
          required: ["filePath", "query"]
        },
        handler: async ({ filePath, query, maxResults }: { filePath: string; query: string; maxResults?: number }) => {
          return await sessionManager.getRelevantContext(filePath, query, maxResults);
        }
      },

      memory_commit: {
        description: "Commit pending changes to memory files",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Specific memory file to commit (commits all if not specified)"
            }
          },
          required: []
        },
        handler: async ({ filePath }: { filePath?: string }) => {
          if (filePath) {
            return await memvidClient.commitChanges(filePath);
          } else {
            return await sessionManager.commitAll();
          }
        }
      },

      memory_get_stats: {
        description: "Get memory file statistics and information",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the memory file"
            }
          },
          required: ["filePath"]
        },
        handler: async ({ filePath }: { filePath: string }) => {
          return await sessionManager.getMemoryStats(filePath);
        }
      }
    },

    // Plugin lifecycle hooks for memory integration
    hooks: {
      /**
       * Session creation hook - Initialize daily memory files
       * Requirements: 5.6, 5.7
       */
      "session.created": async (context: SessionCreatedContext) => {
        try {
          console.log(`Initializing memory for session ${context.session.id} in ${context.session.directory}`);
          
          // Initialize session memory files
          const initResult = await sessionManager.initializeSessionMemory(context.session);
          
          if (initResult.success) {
            const { projectFile, sessionFile } = initResult.data!;
            console.log(`Memory files initialized:`);
            console.log(`  Project: ${projectFile}`);
            console.log(`  Session: ${sessionFile}`);
            
            // Store session creation event
            await sessionManager.storeConversation(
              sessionFile,
              `Session started in ${context.session.directory} with agent ${context.session.agent}`,
              context.session.id,
              {
                type: 'session_start',
                topic: 'session-management',
                status: 'active',
                agent: context.session.agent,
                directory: context.session.directory
              }
            );
          } else {
            console.warn('Failed to initialize session memory:', initResult.error?.message);
          }
        } catch (error) {
          console.warn('Error in session.created hook:', error);
        }
      },

      /**
       * Tool execution hook - Store important tool results
       * Requirements: 5.3
       */
      "tool.execute.after": async (context: ToolExecutionResultContext) => {
        try {
          // Only store results for important tools or failed executions
          const shouldStore = context.result?.success === false || 
                            context.tool.includes('vault_') ||
                            context.tool.includes('memory_') ||
                            context.tool.includes('plan_') ||
                            context.tool.includes('search');

          if (shouldStore) {
            // Generate session file path
            const sessionDate = new Date().toISOString().split('T')[0];
            const sessionFile = resolve(directory, config.sessionMemoryPattern.replace('{date}', sessionDate));
            
            // Store tool result
            await sessionManager.storeToolResult(
              sessionFile,
              context.tool,
              context.input,
              context.result,
              'current', // Use 'current' as session ID for now
              {
                topic: 'tool-execution',
                status: context.result?.success ? 'success' : 'error',
                priority: context.result?.success === false ? 'high' : 'medium'
              }
            );
          }
        } catch (error) {
          console.warn('Error in tool.execute.after hook:', error);
        }
      },

      /**
       * Session compaction hook - Inject relevant historical context
       * Requirements: 5.5
       */
      "experimental.session.compacting": async (context: SessionCompactionContext) => {
        try {
          // Generate memory file paths
          const projectFile = resolve(context.session.directory, config.projectMemoryFile);
          const sessionDate = new Date().toISOString().split('T')[0];
          const sessionFile = resolve(context.session.directory, config.sessionMemoryPattern.replace('{date}', sessionDate));
          
          // Extract key topics from current context for search
          const contextText = context.context
            .filter(part => part.type === 'text')
            .map(part => part.content)
            .join(' ');
          
          // Generate search queries from context
          const searchQueries = extractSearchQueries(contextText);
          const relevantContext: Part[] = [];
          
          // Search project memory for relevant context
          for (const query of searchQueries.slice(0, 3)) { // Limit to top 3 queries
            try {
              const searchResult = await sessionManager.getRelevantContext(projectFile, query, 2);
              
              if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
                // Add relevant memories as context
                const memoryContext = formatMemoryContext(searchResult.data, 'Project Memory');
                relevantContext.push({
                  type: 'text',
                  content: memoryContext
                });
              }
            } catch (error) {
              console.warn(`Failed to search project memory for query "${query}":`, error);
            }
          }
          
          // Search recent session memory for relevant context
          try {
            const recentQuery = searchQueries[0] || 'recent activity';
            const sessionSearchResult = await sessionManager.getRelevantContext(sessionFile, recentQuery, 3);
            
            if (sessionSearchResult.success && sessionSearchResult.data && sessionSearchResult.data.length > 0) {
              const sessionContext = formatMemoryContext(sessionSearchResult.data, 'Recent Session Memory');
              relevantContext.push({
                type: 'text',
                content: sessionContext
              });
            }
          } catch (error) {
            console.warn('Failed to search session memory:', error);
          }
          
          // Store current conversation context for future reference
          try {
            const conversationSummary = generateConversationSummary(context.context);
            await sessionManager.storeConversation(
              sessionFile,
              conversationSummary,
              context.session.id,
              {
                type: 'conversation',
                topic: 'session-compaction',
                status: 'archived',
                priority: 'medium'
              }
            );
          } catch (error) {
            console.warn('Failed to store conversation context:', error);
          }
          
          // Return updated context with memory injection
          return {
            context: [...relevantContext, ...context.context]
          };
        } catch (error) {
          console.warn('Error in session compaction hook:', error);
          // Return original context if memory injection fails
          return { context: context.context };
        }
      }
    }
  };
};

/**
 * Extract search queries from context text
 */
function extractSearchQueries(contextText: string): string[] {
  const queries: string[] = [];
  
  // Extract key phrases and topics
  const sentences = contextText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // Look for important keywords and phrases
  const importantPatterns = [
    /(?:implement|create|build|develop)\s+([^.!?]{10,50})/gi,
    /(?:error|issue|problem|bug)\s+([^.!?]{10,50})/gi,
    /(?:feature|functionality|requirement)\s+([^.!?]{10,50})/gi,
    /(?:design|architecture|structure)\s+([^.!?]{10,50})/gi,
    /(?:test|testing|validation)\s+([^.!?]{10,50})/gi
  ];
  
  for (const pattern of importantPatterns) {
    const matches = contextText.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        queries.push(match[1].trim());
      }
    }
  }
  
  // Extract technical terms and project names
  const technicalTerms = contextText.match(/\b[A-Z][a-zA-Z]*(?:[A-Z][a-zA-Z]*)*\b/g) || [];
  const uniqueTerms = [...new Set(technicalTerms)].filter(term => term.length > 3);
  queries.push(...uniqueTerms.slice(0, 5));
  
  // Add fallback queries if none found
  if (queries.length === 0) {
    queries.push('recent work', 'current project', 'implementation');
  }
  
  return queries.slice(0, 10); // Limit to 10 queries
}

/**
 * Format memory search results as context
 */
function formatMemoryContext(memories: any[], title: string): string {
  const lines = [
    `## ${title}`,
    ''
  ];
  
  for (const memory of memories) {
    lines.push(`### ${memory.title || 'Memory Entry'}`);
    lines.push('');
    lines.push(memory.content || memory.snippet || '');
    lines.push('');
    
    if (memory.tags) {
      const tagList = Object.entries(memory.tags)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      lines.push(`*Tags: ${tagList}*`);
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

/**
 * Generate a summary of conversation context
 */
function generateConversationSummary(context: Part[]): string {
  const textParts = context.filter(part => part.type === 'text');
  const toolParts = context.filter(part => part.type === 'tool_use' || part.type === 'tool_result');
  
  const lines = [
    '## Conversation Summary',
    '',
    `**Context Parts:** ${context.length}`,
    `**Text Parts:** ${textParts.length}`,
    `**Tool Parts:** ${toolParts.length}`,
    `**Timestamp:** ${new Date().toISOString()}`,
    ''
  ];
  
  // Add key topics from text content
  const allText = textParts.map(part => part.content).join(' ');
  const keyTopics = extractSearchQueries(allText).slice(0, 5);
  
  if (keyTopics.length > 0) {
    lines.push('**Key Topics:**');
    for (const topic of keyTopics) {
      lines.push(`- ${topic}`);
    }
    lines.push('');
  }
  
  // Add tool usage summary
  if (toolParts.length > 0) {
    lines.push('**Tools Used:**');
    const toolNames = new Set();
    for (const part of toolParts) {
      if (part.type === 'tool_use' && part.content?.name) {
        toolNames.add(part.content.name);
      }
    }
    for (const toolName of toolNames) {
      lines.push(`- ${toolName}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

export default memoryManagementPlugin;