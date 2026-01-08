# Requirements Document

## Introduction

This document defines the requirements for migrating Claudesidian from a monolithic Obsidian plugin to a distributed OpenCode-based architecture. The migration separates UI concerns (Obsidian plugin) from business logic (OpenCode plugins) to achieve better modularity, security, and maintainability.

## Glossary

- **Claudesidian**: The current monolithic Obsidian plugin for AI-assisted note-taking
- **OpenCode**: The target distributed architecture platform
- **Vault**: An Obsidian workspace containing notes and configuration
- **Plugin**: A modular component that provides specific functionality
- **MCP_Server**: Model Context Protocol server providing AI tools
- **Permission_Manager**: Component responsible for security and access control
- **Vault_Context**: Component providing file system access within vault boundaries
- **Session_Manager**: Component managing user interaction sessions
- **Plan_Mode**: Two-phase execution mode (plan generation, then execution)

## Requirements

### Requirement 1: Architecture Separation

**User Story:** As a system architect, I want clear separation between UI and business logic, so that the system is maintainable and each layer can evolve independently.

#### Acceptance Criteria

1. THE Obsidian_Plugin SHALL only handle UI rendering and user interaction
2. THE OpenCode_Plugins SHALL handle all business logic and data processing
3. WHEN UI implementations are modified THEN the business logic SHALL continue functioning unchanged
4. WHEN business logic is updated THEN the UI layer SHALL operate without modification
5. THE Obsidian_Plugin SHALL communicate with OpenCode_Plugins only through HTTP/WebSocket APIs

### Requirement 2: Modular Plugin System

**User Story:** As a developer, I want the system split into independent plugins, so that I can maintain and extend specific functionality without affecting other components.

#### Acceptance Criteria

1. THE System SHALL implement exactly 9 independent OpenCode plugins
2. EACH Plugin SHALL have clearly defined responsibilities and interfaces
3. WHEN a plugin fails THEN other plugins SHALL continue operating normally
4. THE System SHALL load plugins in the correct dependency order
5. EACH Plugin SHALL declare its dependencies explicitly

### Requirement 3: Security and Permission Management

**User Story:** As a security-conscious user, I want robust permission controls, so that AI agents cannot execute unauthorized commands or access protected files.

#### Acceptance Criteria

1. THE Permission_Manager SHALL implement whitelist-based command filtering
2. WHEN a bash command is requested THEN the system SHALL validate it against the whitelist before execution
3. THE System SHALL detect and block command injection attempts
4. THE System SHALL detect and block path traversal attempts
5. THE System SHALL require user approval for all bash commands
6. THE Vault_Context SHALL enforce jail restrictions preventing access outside the vault root
7. THE System SHALL block access to protected directories (.obsidian, .git, node_modules, .opencode, .claude)

### Requirement 4: File System Operations

**User Story:** As a user, I want secure file operations within my vault, so that I can read, write, and search files while maintaining security boundaries.

#### Acceptance Criteria

1. THE Vault_Context SHALL provide tools for reading files within the vault
2. THE Vault_Context SHALL provide tools for writing files within the vault
3. THE Vault_Context SHALL provide tools for listing files within the vault
4. THE Vault_Context SHALL provide tools for searching file content within the vault
5. THE Vault_Context SHALL provide tools for scanning context paths within the vault
6. WHEN any file operation is requested THEN the system SHALL validate the path is within vault boundaries
7. WHEN a symlink is encountered THEN the system SHALL resolve it and validate the target path

### Requirement 5: Memory Management Integration

**User Story:** As a user, I want persistent memory across sessions, so that the AI can remember previous conversations and context.

#### Acceptance Criteria

1. THE Memory_Management SHALL integrate with Memvid MCP server
2. THE System SHALL automatically store important conversations in memory
3. THE System SHALL automatically store tool results in memory
4. THE System SHALL automatically store decisions and plans in memory
5. WHEN a new session starts THEN the system SHALL search for relevant historical context
6. THE System SHALL create daily session memory files
7. THE System SHALL maintain a permanent project memory file

### Requirement 6: Plan Mode Execution

**User Story:** As a user, I want two-phase plan execution, so that I can review and approve plans before they are executed.

#### Acceptance Criteria

1. THE Plan_Mode SHALL implement two distinct phases: plan generation and plan execution
2. WHEN generating a plan THEN the system SHALL NOT execute any tools
3. WHEN a plan is generated THEN the system SHALL present it to the user for approval
4. WHEN a plan is approved THEN the system SHALL execute each step in sequence
5. THE System SHALL track plan execution progress and results
6. WHEN a plan step fails THEN the system SHALL stop execution and report the error

### Requirement 7: Image Processing

**User Story:** As a user, I want to analyze and process images, so that I can extract information and work with visual content.

#### Acceptance Criteria

1. THE Image_Processor SHALL provide tools for analyzing images
2. THE Image_Processor SHALL provide tools for encoding images to base64
3. THE Image_Processor SHALL provide tools for compressing images
4. THE System SHALL support OCR text extraction from images
5. THE System SHALL support object detection in images
6. WHEN processing large images THEN the system SHALL handle them efficiently without memory issues

### Requirement 8: Session Management

**User Story:** As a user, I want intelligent session management, so that the system understands my vault structure and provides relevant context.

#### Acceptance Criteria

1. THE Session_Manager SHALL detect if the current directory is an Obsidian vault
2. WHEN a vault is detected THEN the system SHALL analyze the PARA structure
3. THE System SHALL provide vault-specific context in the system prompt
4. THE Session_Manager SHALL cache vault analysis to improve performance
5. THE System SHALL handle both vault and non-vault directories appropriately

### Requirement 9: MCP Server Management

**User Story:** As a user, I want secure MCP server execution, so that external tools run safely without compromising my system.

#### Acceptance Criteria

1. THE MCP_Router SHALL manage MCP server lifecycle
2. THE System SHALL execute MCP servers in sandboxed environments
3. THE System SHALL enforce resource limits on MCP servers
4. THE System SHALL log all MCP server activities for audit purposes
5. WHEN an MCP server exceeds resource limits THEN the system SHALL terminate it
6. THE System SHALL support Docker-based sandboxing for MCP servers

### Requirement 10: Event-Driven Communication

**User Story:** As a developer, I want event-driven communication between components, so that the system is responsive and loosely coupled.

#### Acceptance Criteria

1. THE System SHALL implement a comprehensive event system
2. THE System SHALL emit events for all major state changes
3. THE Obsidian_Plugin SHALL consume events via Server-Sent Events
4. THE System SHALL support both session-specific and global events
5. THE System SHALL provide real-time streaming of AI responses
6. WHEN events are emitted THEN all registered listeners SHALL receive them

### Requirement 11: Configuration Management

**User Story:** As a user, I want centralized configuration, so that I can customize system behavior and permissions in one place.

#### Acceptance Criteria

1. THE System SHALL use opencode.jsonc for all configuration
2. THE Configuration SHALL support per-agent permission overrides
3. THE Configuration SHALL support MCP server sandbox settings
4. THE Configuration SHALL support memory management settings
5. THE Configuration SHALL support logging configuration
6. WHEN configuration changes THEN the system SHALL apply them without restart

### Requirement 12: Backward Compatibility

**User Story:** As an existing Claudesidian user, I want my current setup to continue working, so that I don't lose functionality during migration.

#### Acceptance Criteria

1. THE System SHALL maintain compatibility with existing Obsidian plugin APIs
2. THE System SHALL preserve all current keyboard shortcuts and UI interactions
3. THE System SHALL maintain compatibility with existing vault structures
4. THE System SHALL preserve user settings and preferences
5. WHEN migrating THEN existing functionality SHALL remain available