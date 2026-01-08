# Implementation Plan: OpenCode Migration

## Overview

This implementation plan converts the comprehensive OpenCode migration design into discrete coding tasks. The approach follows a modular plugin-by-plugin implementation strategy, building the core infrastructure first, then adding business logic plugins, and finally integrating the UI layer.

## Tasks

- [x] 1. Set up OpenCode plugin infrastructure
  - Create `.opencode/plugin/` directory structure
  - Set up TypeScript configuration for plugins
  - Create shared interfaces and types
  - Set up testing framework (Jest + fast-check for property-based testing)
  - _Requirements: 2.1, 2.2_

- [x] 2. Implement Vault Context Plugin
  - [x] 2.1 Create core vault context plugin structure
    - Write plugin skeleton with proper exports
    - Implement StandardToolResult interface
    - Set up path validation utilities
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 2.2 Write property test for path security validation
    - **Property 1: Path Security Validation**
    - **Validates: Requirements 3.4, 3.6, 3.7, 4.6, 4.7**

  - [x] 2.3 Implement vault file operations tools
    - Implement `vault_read_file` tool with security validation
    - Implement `vault_write_file` tool with safety checks
    - Implement `vault_list_files` tool with pattern matching
    - Implement `vault_search_content` tool
    - Implement `vault_scan_context_paths` tool
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 2.4 Write unit tests for vault operations
    - Test file reading with valid and invalid paths
    - Test file writing with permission checks
    - Test directory listing and search functionality
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3. Implement Permission Manager Plugin
  - [x] 3.1 Create permission manager plugin structure
    - Write plugin skeleton with hook system
    - Implement command parser with tokenization
    - Set up whitelist configuration
    - _Requirements: 3.1, 3.2_

  - [ ]* 3.2 Write property test for command whitelist enforcement
    - **Property 2: Command Whitelist Enforcement**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**

  - [x] 3.3 Implement security validation logic
    - Implement bypass attempt detection
    - Implement command injection detection
    - Implement encoding detection (URL, Base64)
    - Implement whitelist validation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.4 Write unit tests for security features
    - Test command parsing with various inputs
    - Test injection detection with malicious patterns
    - Test whitelist validation with allowed/blocked commands
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 4. Checkpoint - Core Security Foundation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Session Manager Plugin
  - [x] 5.1 Create session manager plugin structure
    - Write plugin skeleton with vault analysis
    - Implement vault detection logic
    - Set up PARA structure scanning
    - Implement caching system
    - _Requirements: 8.1, 8.2, 8.4_

  - [ ]* 5.2 Write property test for vault detection and analysis
    - **Property 11: Vault Detection and Analysis**
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [ ]* 5.3 Write property test for vault analysis caching
    - **Property 12: Vault Analysis Caching**
    - **Validates: Requirements 8.4**

  - [ ]* 5.4 Write property test for directory type handling
    - **Property 13: Directory Type Handling**
    - **Validates: Requirements 8.5**

  - [x] 5.5 Implement session compaction hook
    - Implement `experimental.session.compacting` hook
    - Add vault-specific context injection
    - Integrate with caching system
    - _Requirements: 8.3, 8.4, 8.5_

- [x] 6. Implement Memory Management Plugin
  - [x] 6.1 Create memory management plugin structure
    - Write plugin skeleton with Memvid integration
    - Implement memory storage tools
    - Set up session file management
    - _Requirements: 5.1, 5.6, 5.7_

  - [ ]* 6.2 Write property test for automatic memory storage
    - **Property 5: Automatic Memory Storage**
    - **Validates: Requirements 5.2, 5.3, 5.4**

  - [ ]* 6.3 Write property test for session context injection
    - **Property 6: Session Context Injection**
    - **Validates: Requirements 5.5**

  - [ ]* 6.4 Write property test for memory file management
    - **Property 7: Memory File Management**
    - **Validates: Requirements 5.6, 5.7**

  - [x] 6.5 Implement memory integration hooks
    - Implement session creation hook for daily files
    - Implement message storage hook
    - Implement tool result storage hook
    - Implement compaction hook with context injection
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 7. Implement Plan Mode Plugin
  - [x] 7.1 Create plan mode plugin structure
    - Write plugin skeleton with plan state management
    - Implement plan generation phase
    - Implement plan execution phase
    - Set up progress tracking
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_

  - [ ]* 7.2 Write property test for plan mode tool isolation
    - **Property 8: Plan Mode Tool Isolation**
    - **Validates: Requirements 6.2**

  - [ ]* 7.3 Write property test for plan sequential execution
    - **Property 9: Plan Sequential Execution**
    - **Validates: Requirements 6.4, 6.5, 6.6**

  - [x] 7.4 Implement plan execution logic
    - Implement two-phase execution (generation then execution)
    - Implement step-by-step execution with progress tracking
    - Implement error handling and execution stopping
    - _Requirements: 6.2, 6.4, 6.5, 6.6_

- [ ] 8. Implement MCP Router Plugin
  - [x] 8.1 Create MCP router plugin structure
    - Write plugin skeleton with server lifecycle management
    - Implement Docker sandbox configuration
    - Set up resource limit enforcement
    - Implement audit logging
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 8.2 Write property test for MCP server lifecycle management
    - **Property 14: MCP Server Lifecycle Management**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

  - [x] 8.3 Implement sandbox execution environment
    - Implement Docker container creation and management
    - Implement resource limit enforcement
    - Implement network and filesystem restrictions
    - Implement server termination on limit violations
    - _Requirements: 9.2, 9.3, 9.5_

- [ ] 9. Implement Supporting Plugins
  - [x] 9.1 Create Image Processor Plugin
    - Write plugin skeleton with image processing tools
    - Implement image analysis, encoding, and compression
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 9.2 Write property test for image processing capabilities
    - **Property 10: Image Processing Capabilities**
    - **Validates: Requirements 7.4, 7.5**

  - [x] 9.3 Create Slash Commands Plugin
    - Write plugin skeleton for command handling
    - Implement command registration and execution
    - _Requirements: 2.1_

  - [x] 9.4 Create Stream Plugin
    - Write plugin skeleton for streaming support
    - Implement real-time response streaming
    - _Requirements: 10.5_

- [ ] 10. Checkpoint - Plugin System Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement Plugin Integration and Event System
  - [x] 11.1 Create plugin loading system
    - Implement dependency-aware plugin loading
    - Implement plugin registration and lifecycle management
    - _Requirements: 2.4_

  - [ ]* 11.2 Write property test for plugin fault isolation
    - **Property 3: Plugin Fault Isolation**
    - **Validates: Requirements 2.3**

  - [ ]* 11.3 Write property test for plugin dependency loading
    - **Property 4: Plugin Dependency Loading**
    - **Validates: Requirements 2.4**

  - [x] 11.4 Implement comprehensive event system
    - Implement event emission for state changes
    - Implement event scoping (session-specific vs global)
    - Implement event listener registration and delivery
    - _Requirements: 10.2, 10.4, 10.6_

  - [ ]* 11.5 Write property test for event system behavior
    - **Property 15: Event System Behavior**
    - **Validates: Requirements 10.2, 10.4, 10.5, 10.6**

- [x] 12. Implement Configuration System
  - [x] 12.1 Create opencode.jsonc configuration structure
    - Define configuration schema
    - Implement configuration loading and validation
    - Set up per-agent permission overrides
    - _Requirements: 11.1, 11.2_

  - [ ]* 12.2 Write property test for configuration runtime updates
    - **Property 16: Configuration Runtime Updates**
    - **Validates: Requirements 11.2, 11.6**

  - [x] 12.3 Implement configuration hot-reloading
    - Implement configuration change detection
    - Implement runtime configuration updates without restart
    - _Requirements: 11.6_

- [x] 13. Implement Obsidian Plugin UI Layer
  - [x] 13.1 Create thin Obsidian plugin structure
    - Create minimal plugin.ts with UI components only
    - Implement OpenCode client for HTTP/WebSocket communication
    - Set up event stream consumption
    - _Requirements: 1.1, 1.5_

  - [x] 13.2 Implement UI components
    - Implement ClaudianView renderer for messages
    - Implement input UI components
    - Implement approval UI modals
    - _Requirements: 1.1_

  - [x] 13.3 Implement event stream integration
    - Implement Server-Sent Events consumption
    - Implement real-time UI updates
    - Implement permission request handling
    - _Requirements: 10.3, 10.5_

- [x] 14. Migration and Compatibility
  - [x] 14.1 Implement migration utilities
    - Create migration scripts for existing configurations
    - Implement settings preservation logic
    - _Requirements: 12.4, 12.5_

  - [ ]* 14.2 Write property test for migration compatibility
    - **Property 17: Migration Compatibility**
    - **Validates: Requirements 12.3, 12.4, 12.5**

  - [x] 14.3 Implement backward compatibility layer
    - Ensure existing vault structures work
    - Preserve existing functionality during migration
    - _Requirements: 12.1, 12.3, 12.5_

- [-] 15. Integration Testing and Final Validation
  - [ ]* 15.1 Write integration tests
    - Test end-to-end user workflows
    - Test plugin interaction scenarios
    - Test UI layer communication
    - _Requirements: All_

  - [ ] 15.2 Performance optimization
    - Optimize plugin loading and execution
    - Optimize memory usage and caching
    - Optimize event stream performance
    - _Requirements: 8.4_

- [ ] 16. Final checkpoint - Complete system validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- The implementation follows the plugin dependency order for proper initialization
- All security features are implemented early to ensure system safety
- Memory integration and event system are implemented after core plugins are stable