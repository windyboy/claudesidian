# OpenCode Plugin Infrastructure

This directory contains the modular plugin system for the Claudesidian OpenCode migration. The system separates UI concerns (Obsidian plugin) from business logic (OpenCode plugins) to achieve better modularity, security, and maintainability.

## Architecture Overview

The plugin system consists of 9 independent OpenCode plugins:

1. **vault-context** - Secure file operations within vault boundaries
2. **permission-manager** - Command whitelist validation and security
3. **session-manager** - Vault detection and PARA structure analysis
4. **memory-management** - Memvid integration and context storage
5. **plan-mode** - Two-phase plan execution (generation + execution)
6. **mcp-router** - MCP server lifecycle and sandboxing
7. **image-processor** - Image analysis and processing
8. **slash-commands** - Command handling and registration
9. **stream-plugin** - Real-time response streaming

## Plugin Dependencies

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

## Files Structure

- `types.ts` - Shared interfaces and types for all plugins
- `plugin-loader.ts` - Plugin dependency resolution and loading system
- `session-hooks.ts` - Session management plugin (existing)
- `test-utils.ts` - Property-based testing utilities and generators
- `__tests__/` - Test directory with Jest + fast-check setup

## Development Setup

### Prerequisites

- Node.js 18+
- TypeScript 5.3+
- Jest 29+ for testing
- fast-check 3.15+ for property-based testing

### Installation

```bash
cd .opencode/plugin
npm install
```

### Available Scripts

- `npm test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run build` - Compile TypeScript
- `npm run build:watch` - Compile TypeScript in watch mode
- `npm run lint` - Lint and fix code
- `npm run lint:check` - Check linting without fixing

## Testing Strategy

### Dual Testing Approach

The system uses both unit testing and property-based testing:

**Unit Tests:**
- Test specific examples and edge cases
- Verify integration points between components
- Test error conditions and boundary cases

**Property-Based Tests:**
- Test universal properties across all inputs
- Use randomized input generation for comprehensive coverage
- Minimum 100 iterations per property test
- Each test tagged with: `Feature: use-opencode, Property {number}: {property_text}`

### Property Test Configuration

```typescript
import { createPropertyTest, runPropertyTest } from './test-utils.js';

createPropertyTest(
  'feature-name',
  1,
  'Property description',
  () => {
    const property = fc.property(generator(), (input) => {
      // Test logic here
      return condition;
    });
    
    runPropertyTest(property);
  }
);
```

### Test Generators

The `test-utils.ts` file provides generators for:

- `validVaultPath()` - Valid file paths within vault boundaries
- `maliciousPath()` - Path traversal attack attempts
- `protectedPath()` - Protected directory paths
- `bashCommand()` - Valid bash commands
- `maliciousBashCommand()` - Command injection attempts
- `encodedCommand()` - Encoded bypass attempts
- `standardToolResult()` - StandardToolResult instances
- `vaultInfo()` - VaultInfo structures
- `session()` - Session objects
- `planState()` - Plan execution states

## Plugin Development

### Creating a New Plugin

1. Create plugin file: `{plugin-name}.ts`
2. Import shared types: `import { StandardToolResult, ... } from './types.js'`
3. Implement plugin interface following OpenCode plugin API
4. Add dependency configuration if needed
5. Create tests in `__tests__/{plugin-name}.test.ts`

### Plugin Interface

```typescript
import type { Plugin } from "@opencode-ai/plugin";
import { StandardToolResult, createSuccessResult, createErrorResult } from './types.js';

export const myPlugin: Plugin = async ({ client, $, directory }) => {
  return {
    tools: {
      my_tool: async (input: any): Promise<StandardToolResult> => {
        try {
          // Tool implementation
          return createSuccessResult(result);
        } catch (error) {
          return createErrorResult(ErrorCode.UNKNOWN_ERROR, error.message);
        }
      }
    },
    
    event: async ({ event }) => {
      if (event.type === "session.created") {
        // Handle session creation
      }
    }
  };
};

export default myPlugin;
```

### Error Handling

All plugins should use the `StandardToolResult` interface for consistent error handling:

```typescript
import { createErrorResult, ErrorCode } from './types.js';

// For validation errors
return createErrorResult(
  ErrorCode.VALIDATION_ERROR,
  'Invalid input provided',
  { input, reason: 'Path contains invalid characters' }
);

// For security violations
return createErrorResult(
  ErrorCode.JAIL_VIOLATION,
  'Path attempts to access outside vault boundaries',
  { path, vaultRoot }
);
```

## Security Considerations

### Path Validation

All file operations must validate paths using the vault context plugin:

- Prevent path traversal attacks (`../../../etc/passwd`)
- Block access to protected directories (`.obsidian`, `.git`, `node_modules`)
- Resolve symlinks and validate target paths
- Enforce jail boundaries within vault root

### Command Security

All bash commands must be validated by the permission manager:

- Whitelist-based command filtering
- Command injection detection
- Encoding bypass prevention (URL, Base64, hex)
- User approval requirements for dangerous operations

### Plugin Isolation

Plugins are designed with fault isolation:

- Plugin failures don't affect other plugins
- Dependency resolution prevents circular dependencies
- Resource limits prevent resource exhaustion
- Sandbox execution for MCP servers

## Configuration

Plugin configuration is managed through `opencode.jsonc` in the project root:

```jsonc
{
  "plugins": {
    "vault-context": {
      "enabled": true,
      "jailRoot": ".",
      "protectedPaths": [".obsidian", ".git", "node_modules"]
    },
    "permission-manager": {
      "enabled": true,
      "requireApproval": true,
      "whitelist": ["git *", "npm *", "ls *"]
    }
  }
}
```

## Migration from Claude Code

This plugin system replaces the monolithic Claude Code hooks system:

- **Before**: Single `main.js` file with ~5500 lines
- **After**: 9 modular plugins with clear separation of concerns
- **Benefits**: Better maintainability, security, testability, and extensibility

## Contributing

1. Follow the existing code style and patterns
2. Write both unit tests and property-based tests
3. Use the shared type system and error handling
4. Document plugin dependencies and interfaces
5. Ensure security best practices are followed

## License

MIT - See LICENSE file for details
