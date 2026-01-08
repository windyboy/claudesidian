# Design Document

## Overview

This design document outlines the technical architecture for migrating Claudesidian from a monolithic Obsidian plugin to a distributed OpenCode-based system. The architecture separates concerns between a thin UI layer (Obsidian plugin) and a robust business logic layer (OpenCode plugins).

The migration transforms a ~5500-line monolithic plugin into a modular system with 9 independent OpenCode plugins, each with specific responsibilities and clear interfaces.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Obsidian Plugin Layer                    │
│  (UI Only - ~3000 lines)                                   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ ClaudianView │  │ Input UI     │  │ Approval UI  │     │
│  │ Renderer     │  │ Components   │  │ Modals       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                  │
                  │ HTTP/WebSocket + Event Stream
                  │
┌─────────────────────────────────────────────────────────────┐
│              OpenCode Plugin Layer                          │
│  (Business Logic - ~2500 lines)                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Vault        │  │ Permission   │  │ Plan Mode    │     │
│  │ Context      │  │ Manager      │  │ Plugin       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Slash        │  │ MCP Router   │  │ Session      │     │
│  │ Commands     │  │ Plugin       │  │ Manager      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Image        │  │ Memory       │  │ Stream       │     │
│  │ Processor    │  │ Management   │  │ Plugin       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### Obsidian Plugin Layer (UI Only)
- UI component rendering (messages, input, modals)
- User event capture (clicks, keyboard, drag-drop)
- Event forwarding to OpenCode Client
- OpenCode event stream consumption and display
- Obsidian API proxy calls

#### OpenCode Plugin Layer (Business Logic)
- All business logic processing
- Tool implementation and execution
- Permission management and validation
- State management and persistence
- File operations and path scanning
- Image encoding and processing
- Command expansion and validation
- Configuration management

## Components and Interfaces

### Plugin Dependency Graph

```
vault-context (no deps)
    ↓
session-manager (depends: vault-context)
    ↓
memory-management (depends: session-manager)

permission-manager (no deps)
    ↓
plan-mode (depends: permission-manager)

slash-commands (no deps)
mcp-router (no deps)
image-processor (no deps)
stream-plugin (no deps)
```

### Plugin Loading Order
1. `vault-context`
2. `permission-manager`
3. `slash-commands`
4. `mcp-router`
5. `image-processor`
6. `stream-plugin`
7. `session-manager`
8. `memory-management`
9. `plan-mode`

### Core Interfaces

#### StandardToolResult Interface
```typescript
interface StandardToolResult<T = any> {
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
```

#### Plugin Hook System
```typescript
interface PluginHooks {
  "tool.execute.before": (context: {
    tool: string;
    input: any;
    context: any;
  }) => Promise<void>;

  "tool.execute.after": (context: {
    tool: string;
    input: any;
    result: any;
    context: any;
  }) => Promise<void>;

  "session.created": (context: {
    session: Session;
  }) => Promise<void>;

  "experimental.session.compacting": (context: {
    context: Part[];
    session: Session;
  }) => Promise<{
    context: Part[];
  }>;
}
```

### Vault Context Plugin

**Responsibilities:**
- Secure file operations within vault boundaries
- Path validation and jail enforcement
- File content reading and writing
- Directory listing and content search

**Key Security Features:**
- Path normalization and symlink resolution
- Jail boundary enforcement
- Protected directory blocking
- Bypass attempt detection

**Tools Provided:**
- `vault_read_file`: Read file content with metadata
- `vault_write_file`: Write file content with safety checks
- `vault_list_files`: List files with pattern matching
- `vault_search_content`: Search file content
- `vault_scan_context_paths`: Scan multiple paths for context

### Permission Manager Plugin

**Responsibilities:**
- Command whitelist validation
- Bypass attempt detection
- Permission request handling
- Security policy enforcement

**Security Implementation:**
- Whitelist-based command filtering
- Command injection detection
- Encoding bypass detection
- Path traversal prevention

**Command Parser Features:**
- Token parsing with flag support
- Dangerous character detection
- Encoding detection (URL, Base64)
- Command structure validation

### Memory Management Plugin

**Responsibilities:**
- Memvid MCP integration
- Automatic context storage
- Session memory management
- Historical context retrieval

**Integration Features:**
- Daily session file creation
- Automatic conversation storage
- Tool result archiving
- Context compaction with memory injection

### Plan Mode Plugin

**Responsibilities:**
- Two-phase plan execution
- Plan state management
- Step-by-step execution
- Progress tracking and error handling

**Implementation Phases:**
1. **Plan Generation**: Generate detailed plan without tool execution
2. **Plan Execution**: Execute approved plan step by step

### Session Manager Plugin

**Responsibilities:**
- Vault detection and analysis
- PARA structure scanning
- Context injection during compaction
- Performance optimization through caching

**Vault Analysis Features:**
- Obsidian vault detection
- PARA folder structure analysis
- Plugin settings extraction
- Vault statistics calculation

### MCP Router Plugin

**Responsibilities:**
- MCP server lifecycle management
- Sandboxed execution environment
- Resource limit enforcement
- Audit logging

**Sandbox Configuration:**
- Docker-based isolation
- Resource limits (memory, CPU, time)
- Filesystem restrictions
- Network access control
- Environment variable isolation

### Image Processor Plugin

**Responsibilities:**
- Image analysis and processing
- Base64 encoding
- Image compression
- OCR and object detection

**Processing Features:**
- Metadata extraction
- Multi-format support
- Efficient memory handling
- Progress tracking

## Data Models

### Session State
```typescript
interface Session {
  id: string;
  agent: string;
  model: ModelConfig;
  directory: string;
  created: number;
  state: any;
}
```

### Plan State
```typescript
interface PlanState {
  planId: string;
  sessionId: string;
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'cancelled';
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
```

### Vault Information
```typescript
interface VaultInfo {
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
```

### Security Configuration
```typescript
interface AllowedCommand {
  command: string;
  allowedArgs?: string[];
  allowedFlags?: string[];
  requireApproval?: boolean;
}

interface MCPSandboxConfig {
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
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property-Based Testing Overview

Property-based testing (PBT) validates software correctness by testing universal properties across many generated inputs. Each property is a formal specification that should hold for all valid inputs.

### Core Principles

1. **Universal Quantification**: Every property must contain an explicit "for all" statement
2. **Requirements Traceability**: Each property must reference the requirements it validates
3. **Executable Specifications**: Properties must be implementable as automated tests
4. **Comprehensive Coverage**: Properties should cover all testable acceptance criteria

### Converting EARS to Properties

Based on the prework analysis, I've identified the testable acceptance criteria and will convert them into universally quantified properties. After property reflection to eliminate redundancy, here are the core correctness properties:

**Property 1: Path Security Validation**
*For any* file path and vault root, when validating the path, the system should reject paths outside vault boundaries, paths to protected directories, and malicious symlinks
**Validates: Requirements 3.4, 3.6, 3.7, 4.6, 4.7**

**Property 2: Command Whitelist Enforcement**
*For any* bash command, the system should only allow execution if the command is in the whitelist, requires approval, and passes injection detection
**Validates: Requirements 3.1, 3.2, 3.3, 3.5**

**Property 3: Plugin Fault Isolation**
*For any* plugin failure, other plugins should continue operating normally without being affected by the failed plugin
**Validates: Requirements 2.3**

**Property 4: Plugin Dependency Loading**
*For any* plugin with dependencies, the system should load all dependencies before loading the dependent plugin
**Validates: Requirements 2.4**

**Property 5: Automatic Memory Storage**
*For any* important system event (conversations, tool results, decisions, plans), the system should automatically store it in the appropriate memory file
**Validates: Requirements 5.2, 5.3, 5.4**

**Property 6: Session Context Injection**
*For any* new session in a vault directory, the system should search for relevant historical context and inject it into the session
**Validates: Requirements 5.5**

**Property 7: Memory File Management**
*For any* session, the system should create daily session memory files and maintain a permanent project memory file
**Validates: Requirements 5.6, 5.7**

**Property 8: Plan Mode Tool Isolation**
*For any* plan generation request, the system should generate the plan without executing any tools
**Validates: Requirements 6.2**

**Property 9: Plan Sequential Execution**
*For any* approved plan, the system should execute steps in sequence, track progress, and stop on failure
**Validates: Requirements 6.4, 6.5, 6.6**

**Property 10: Image Processing Capabilities**
*For any* image with known content, the system should correctly extract text via OCR and detect objects
**Validates: Requirements 7.4, 7.5**

**Property 11: Vault Detection and Analysis**
*For any* directory, the system should correctly detect if it's an Obsidian vault and analyze its PARA structure if applicable
**Validates: Requirements 8.1, 8.2, 8.3**

**Property 12: Vault Analysis Caching**
*For any* vault that has been analyzed, subsequent analysis requests should use cached results to improve performance
**Validates: Requirements 8.4**

**Property 13: Directory Type Handling**
*For any* directory (vault or non-vault), the system should handle it appropriately based on its type
**Validates: Requirements 8.5**

**Property 14: MCP Server Lifecycle Management**
*For any* MCP server, the system should properly manage its lifecycle, enforce resource limits, log activities, and terminate on limit violations
**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

**Property 15: Event System Behavior**
*For any* state change or system event, the system should emit appropriate events with correct scoping and ensure all registered listeners receive them
**Validates: Requirements 10.2, 10.4, 10.5, 10.6**

**Property 16: Configuration Runtime Updates**
*For any* configuration change, the system should apply the changes without requiring a restart
**Validates: Requirements 11.2, 11.6**

**Property 17: Migration Compatibility**
*For any* existing vault or user configuration, the migration should preserve compatibility and functionality
**Validates: Requirements 12.3, 12.4, 12.5**

## Error Handling

The system implements comprehensive error handling across all layers:

### Path Validation Errors
- **JAIL_VIOLATION**: Path attempts to access outside vault root
- **PROTECTED_PATH**: Path attempts to access protected directories
- **VALIDATION_ERROR**: General path validation failure

### Command Security Errors
- **COMMAND_INJECTION**: Malicious command patterns detected
- **ENCODING_BYPASS**: Encoded command bypass attempt detected
- **WHITELIST_VIOLATION**: Command not in approved whitelist

### Plugin Errors
- **DEPENDENCY_ERROR**: Plugin dependency not satisfied
- **LIFECYCLE_ERROR**: Plugin lifecycle management failure
- **ISOLATION_ERROR**: Plugin fault isolation failure

### Memory Management Errors
- **STORAGE_ERROR**: Failed to store content in memory
- **RETRIEVAL_ERROR**: Failed to retrieve content from memory
- **COMPACTION_ERROR**: Session compaction failure

### MCP Server Errors
- **RESOURCE_LIMIT_EXCEEDED**: Server exceeded resource limits
- **SANDBOX_ERROR**: Sandboxing failure
- **LIFECYCLE_ERROR**: Server lifecycle management failure

## Testing Strategy

### Dual Testing Approach

The system uses both unit testing and property-based testing for comprehensive coverage:

**Unit Tests:**
- Test specific examples and edge cases
- Verify integration points between components
- Test error conditions and boundary cases
- Focus on concrete scenarios and known inputs

**Property-Based Tests:**
- Test universal properties across all inputs
- Use randomized input generation for comprehensive coverage
- Verify correctness properties hold for all valid inputs
- Each property test runs minimum 100 iterations

### Property-Based Testing Configuration

**Testing Framework:** Use fast-check for TypeScript/JavaScript property-based testing

**Test Configuration:**
- Minimum 100 iterations per property test
- Each test tagged with: **Feature: use-opencode, Property {number}: {property_text}**
- Custom generators for domain-specific inputs (paths, commands, vault structures)

**Property Test Implementation:**
Each correctness property must be implemented as a single property-based test that references its design document property and validates the specified requirements.

### Testing Coverage Areas

**Security Testing:**
- Path traversal prevention
- Command injection prevention  
- Symlink attack prevention
- Resource exhaustion prevention

**Functional Testing:**
- Plugin lifecycle management
- Memory storage and retrieval
- Event system behavior
- Configuration management

**Integration Testing:**
- End-to-end user workflows
- Plugin interaction testing
- MCP server integration
- UI layer communication

**Performance Testing:**
- Large file handling
- Concurrent operations
- Memory usage optimization
- Event stream performance
