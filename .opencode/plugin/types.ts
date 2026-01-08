/**
 * Shared interfaces and types for OpenCode plugins
 * Used across all plugins in the Claudesidian migration
 */

/**
 * Standard result interface for all tool operations
 * Provides consistent error handling and metadata across plugins
 */
export interface StandardToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    duration?: number;
    warnings?: string[];
    timestamp?: number;
  };
}

/**
 * Plugin dependency configuration
 */
export interface PluginDependency {
  name: string;
  version?: string;
  optional?: boolean;
}

/**
 * Plugin configuration metadata
 */
export interface PluginConfig {
  name: string;
  version: string;
  dependencies?: PluginDependency[];
  loadOrder?: number;
}

/**
 * Session information passed to plugins
 */
export interface Session {
  id: string;
  agent: string;
  model: ModelConfig;
  directory: string;
  created: number;
  state: any;
}

/**
 * Model configuration for sessions
 */
export interface ModelConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Vault information structure
 */
export interface VaultInfo {
  isVault: boolean;
  vaultPath: string;
  paraStructure: {
    inbox: string[];
    projects: string[];
    areas: string[];
    resources: string[];
    archive: string[];
  };
  pluginSettings: Record<string, any>;
  totalFiles: number;
  totalSize: number;
}

/**
 * Plan execution state
 */
export interface PlanState {
  planId: string;
  sessionId: string;
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'cancelled' | 'failed';
  plan: {
    title: string;
    description: string;
    steps: PlanStep[];
  };
  execution?: {
    currentStep: number;
    startTime: number;
    results: Array<{
      stepId: string;
      result: any;
      timestamp: number;
    }>;
  };
}

/**
 * Individual plan step
 */
export interface PlanStep {
  id: string;
  title: string;
  description: string;
  tool?: string;
  parameters?: any;
  dependencies?: string[];
}

/**
 * Security configuration for commands
 */
export interface AllowedCommand {
  command: string;
  allowedArgs?: string[];
  allowedFlags?: string[];
  requireApproval?: boolean;
}

/**
 * MCP server sandbox configuration
 */
export interface MCPSandboxConfig {
  sandboxType: 'none' | 'chroot' | 'docker' | 'wasm';
  resourceLimits?: {
    maxMemoryMB?: number;
    maxCpuPercent?: number;
    maxExecutionTime?: number;
  };
  filesystem?: {
    readOnly?: boolean;
    jailRoot?: string;
    allowedPaths?: string[];
    deniedPaths?: string[];
  };
  network?: {
    enabled: boolean;
    allowedHosts?: string[];
    allowedPorts?: number[];
  };
}

/**
 * Plugin hook context for tool execution
 */
export interface ToolExecutionContext {
  tool: string;
  input: any;
  context: any;
}

/**
 * Plugin hook context for tool execution results
 */
export interface ToolExecutionResultContext extends ToolExecutionContext {
  result: any;
}

/**
 * Plugin hook context for session creation
 */
export interface SessionCreatedContext {
  session: Session;
}

/**
 * Plugin hook context for session compaction
 */
export interface SessionCompactionContext {
  context: Part[];
  session: Session;
}

/**
 * Context part for session compaction
 */
export interface Part {
  type: 'text' | 'tool_use' | 'tool_result';
  content: any;
}

/**
 * Plugin hook system interface
 */
export interface PluginHooks {
  "tool.execute.before": (context: ToolExecutionContext) => Promise<void>;
  "tool.execute.after": (context: ToolExecutionResultContext) => Promise<void>;
  "session.created": (context: SessionCreatedContext) => Promise<void>;
  "session.ended": (context: { sessionId: string }) => Promise<void>;
  "experimental.session.compacting": (context: SessionCompactionContext) => Promise<{
    context: Part[];
  }>;
  "plugin.loaded": (context: { pluginName: string; instance: any }) => Promise<void>;
  "plugin.unloaded": (context: { pluginName: string }) => Promise<void>;
  "plugin.failed": (context: { pluginName: string; error: Error }) => Promise<void>;
  "system.initialized": (context: { loaded: string[]; failed: string[] }) => Promise<void>;
  "system.shutdown": (context: { unloaded: string[] }) => Promise<void>;
  "event.emitted": (context: { eventType: string; scope: string; data: any }) => Promise<void>;
}

/**
 * Error codes used across plugins
 */
export enum ErrorCode {
  // Path validation errors
  JAIL_VIOLATION = 'JAIL_VIOLATION',
  PROTECTED_PATH = 'PROTECTED_PATH',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // Command security errors
  COMMAND_INJECTION = 'COMMAND_INJECTION',
  ENCODING_BYPASS = 'ENCODING_BYPASS',
  WHITELIST_VIOLATION = 'WHITELIST_VIOLATION',
  
  // Plugin errors
  DEPENDENCY_ERROR = 'DEPENDENCY_ERROR',
  LIFECYCLE_ERROR = 'LIFECYCLE_ERROR',
  ISOLATION_ERROR = 'ISOLATION_ERROR',
  
  // Memory management errors
  STORAGE_ERROR = 'STORAGE_ERROR',
  RETRIEVAL_ERROR = 'RETRIEVAL_ERROR',
  COMPACTION_ERROR = 'COMPACTION_ERROR',
  
  // MCP server errors
  RESOURCE_LIMIT_EXCEEDED = 'RESOURCE_LIMIT_EXCEEDED',
  SANDBOX_ERROR = 'SANDBOX_ERROR',
  
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Utility function to create a successful result
 */
export function createSuccessResult<T>(data: T, metadata?: StandardToolResult<T>['metadata']): StandardToolResult<T> {
  return {
    success: true,
    data,
    metadata: {
      timestamp: Date.now(),
      ...metadata
    }
  };
}

/**
 * Permission level for tools and operations
 */
export type PermissionLevel = 'allow' | 'ask' | 'deny';

/**
 * Permission configuration for tools
 */
export interface PermissionConfig {
  [toolName: string]: PermissionLevel | {
    [pattern: string]: PermissionLevel;
  };
}

/**
 * Agent configuration with permissions and options
 */
export interface AgentConfig {
  description: string;
  permission: PermissionConfig;
  options: Record<string, any>;
}

/**
 * Memory management configuration
 */
export interface MemoryConfig {
  enabled: boolean;
  projectMemoryFile?: string;
  sessionMemoryPattern?: string;
  autoStore?: {
    conversations: boolean;
    toolResults: boolean;
    decisions: boolean;
    plans: boolean;
  };
  searchContextSize?: number;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  file?: string;
  console: boolean;
  audit: {
    enabled: boolean;
    file?: string;
    includeToolResults: boolean;
    includeSensitiveData: boolean;
  };
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  command?: string[];
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  sandbox?: MCPSandboxConfig;
  timeout?: number;
  retries?: number;
  disabled?: boolean;
}

/**
 * Complete OpenCode configuration structure
 */
export interface OpenCodeConfig {
  $schema?: string;
  agent: Record<string, AgentConfig>;
  permission: PermissionConfig;
  mcp?: Record<string, MCPServerConfig>;
  memory?: MemoryConfig;
  logging?: LoggingConfig;
  plugins?: {
    directory?: string;
    autoLoad?: boolean;
    loadOrder?: string[];
  };
  events?: {
    maxListeners?: number;
    timeout?: number;
  };
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    value?: any;
  }>;
  warnings: Array<{
    path: string;
    message: string;
    value?: any;
  }>;
}

/**
 * Configuration change event data
 */
export interface ConfigChangeEvent {
  path: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

/**
 * Utility function to create an error result
 */
export function createErrorResult(
  code: ErrorCode | string,
  message: string,
  details?: any,
  metadata?: StandardToolResult['metadata']
): StandardToolResult {
  return {
    success: false,
    error: {
      code,
      message,
      details
    },
    metadata: {
      timestamp: Date.now(),
      ...metadata
    }
  };
}