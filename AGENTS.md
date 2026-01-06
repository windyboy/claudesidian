# AGENTS.md - Development Guidelines for Claudesidian

This document provides essential guidelines for agentic coding assistants
working in this repository.

## Build/Lint/Format Commands

### Essential Commands

- `pnpm lint` - Run ESLint with auto-fix AND format with Prettier
- `pnpm lint:check` - Check only without auto-fixing
- `pnpm format` - Format code with Prettier only
- `pnpm format:check` - Check formatting without modifying files
- `pnpm test-gemini` - Test Gemini Vision MCP server (requires GEMINI_API_KEY
  env var)

### Running Single Tests

This project uses helper scripts and manual testing rather than automated unit
tests:

- Test MCP servers: `node .claude/mcp-servers/<server-name>.mjs`
- Test shell scripts: `bash .scripts/<script-name>.sh`
- Test commands: Use OpenCode to execute `/command-name` interactively

## Code Style Guidelines

### JavaScript/TypeScript (.mjs, .js files)

#### Imports & Formatting

- Use ES6 imports with `node:` prefix: `import fs from 'node:fs/promises'`
- Enforce import ordering via perfectionist plugin (natural sort)
- Single quotes, no semicolons, prose wrap: always
- Use inline type imports: `import { type Foo } from 'module'`

#### TypeScript Rules

- **NO `any` types** - Use proper types or `unknown`
- Use `const` assertions: `type Mode = 'read' | 'write' as const`
- Prefer `interface` over `type` when extending
- Explicit function return types for public APIs
- Use `readonly` for class properties, `??`/`?.` for null checks
- Prefix unused vars with `_`: `const _unused = ...`

#### Error Handling

- Use `process.exit(1)` for fatal errors with helpful messages to console.error
- Validate env vars early, fail fast with setup instructions
- Use try/catch for async, check file existence with `fs.access()`

#### Naming Conventions

- camelCase for vars/functions: `uploadFile`, `apiKey`
- PascalCase for classes/types: `GoogleGenerativeAI`
- UPPER_CASE for constants: `GEMINI_API_KEY`, `MAX_ATTEMPTS`
- kebab-case for scripts/files: `gemini-vision.mjs`, `vault-stats.sh`
- Descriptive names: `waitForVideoProcessing` (not `wait`)

#### Code Patterns

- Use async/await, not Promises directly
- Destructure parameters: `const { name, path } = args`
- Prefer template literals: `` `File: ${filePath}` ``
- Object shorthand: `{ name, path }` not `{ name: name }`
- Extract helper functions: `expandPath`, `sleep`
- Use named functions for better stack traces
- Comment complex logic briefly (what/why, not how)

### Shell Scripts (.sh files)

#### Conventions

- Shebang: `#!/bin/bash` (not `#!/bin/sh`)
- Use functions: `check_command() { ... }`
- Quote variables: `"$filepath"` (prevents word splitting)
- Redirect stderr: `2>/dev/null` when appropriate
- Use `command -v` to check commands exist
- Exit codes: 0 = success, non-zero = failure
- Use `-e` flag: `set -e` (exit on error)
- Error messages to stderr: `echo "❌ Error" >&2`

#### File Paths

- Use underscores in folder names: `05_Attachments`, `06_Metadata`
- Never use spaces in folder names
- Hardcode paths: `00_Inbox/`, `01_Projects/`, etc.
- Quote all paths in scripts: `"00_Inbox/$filename"`

### Command/Agent Files (.md files in .opencode/command/)

#### Structure

- Frontmatter with `agent` field specifying which agent profile to use
- H1 title: `# Command Name`
- Brief description of purpose
- Use H2 for major sections: `## Core Behaviors`, `## Workflow`, `## Tips`
- Use code blocks: ` ```markdown `, ` ```bash `
- Numbered lists for sequential steps
- Bullet points for general guidelines

#### Frontmatter Format

```markdown
---
agent: [agent-name]
description: [One-line description]
argument-hint: [Optional: what user should provide]
---
```

#### Agent Profiles

- **bootstrap**: Full access for setup and system operations
- **thinking-partner**: Read-only for exploration
- **research-assistant**: Read/write with web access (ask)
- **assistant**: Standard permissions with safety checks
- **read-only**: Minimal permissions for safe review

See `PERMISSION-SYSTEM.md` for detailed permission information.

#### Tone

- Direct and actionable (imperative: "Search the vault")
- Second-person: "You are X", "When engaged..."
- Concise instructions with key prompts

### Git Workflow

#### Best Practices

- **ALWAYS** run `git pull` at start of each session
- Commit frequently: `git add . && git commit -m "message" && git push`
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
- Never commit secrets (.env files, API keys)
- Commit after agent modifies files
- Use branches for experiments: `git checkout -b feature/feature-name`

#### Commit Message Examples

```
feat: add new MCP server for XYZ
fix: correct path handling in vault-stats.sh
docs: update AGENTS.md with new guidelines
refactor: extract helper functions from main script
chore: update dependencies to latest versions
```

### PARA Method for Note Organization

Obsidian vault using PARA method:

- **00_Inbox/** - Temporary captures, process weekly
- **01_Projects/** - Active projects with deadlines (create subfolder)
- **02_Areas/** - Ongoing responsibilities (Health, Finances)
- **03_Resources/** - Reference materials by topic
- **04_Archive/** - Completed projects, inactive items
- **05_Attachments/** - Images, PDFs, attachments (use Organized/)
- **06_Metadata/** - System files, templates, documentation

### File Permissions & Environment

- Make shell scripts executable: `chmod +x script.sh` or use shebang
- JS files via `node` don't need execute permission
- MCP servers use `#!/usr/bin/env node` shebang
- Required: `GEMINI_API_KEY` (for vision features)
- Optional: `FIRECRAWL_API_KEY` (for web research)
- Check in code: `const apiKey = process.env.GEMINI_API_KEY`
- Fail with helpful message if missing required env vars

## Common Patterns

### MCP Server Structure

```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = new Server({ name: 'server-name', version: '1.0.0' }, { capabilities: { tools: {} } })
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...] }))
server.setRequestHandler(CallToolRequestSchema, async (request) => { /* handle tools */ })

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('🚀 Server running')
}
main().catch(console.error)
```

### Shell Script Function

```bash
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ $1 is not installed"
        return 1
    else
        echo "✅ $1 is installed"
        return 0
    fi
}
```

## Testing Your Changes

1. Run `pnpm lint:check` before committing
2. Run `pnpm lint` to auto-fix issues
3. Test shell scripts manually: `bash .scripts/script-name.sh`
4. Test MCP servers: `node .claude/mcp-servers/server-name.mjs`
5. Test core functionality in OpenCode with actual commands
6. Verify file paths match underscore convention (no spaces)

## OpenCode-Specific Guidelines

### Configuration

OpenCode uses `opencode.jsonc` for configuration instead of `.claude/settings.json`:

- **Agent Profiles**: Defined in `opencode.jsonc` with permission rules
- **MCP Servers**: Configured in `opencode.jsonc` with command strings
- **Plugins**: Auto-detected from `.opencode/plugin/` directory
- **Commands**: Auto-detected from `.opencode/command/` directory

### Command Migration from Claude Code

When migrating commands from Claude Code to OpenCode:

1. **Move file**: `.claude/commands/[name].md` → `.opencode/command/[name].md`
2. **Add frontmatter**: Include `agent` field specifying which agent profile to use
3. **Update references**: Change `claude run` → `/command-name` (OpenCode TUI)
4. **Update MCP commands**: Change `claude mcp add` → `opencode mcp add`
5. **Preserve content**: Keep all instructions and workflows intact

### Permission System

OpenCode uses a permission-based system with three levels:

- **allow**: Agent can use tool without asking
- **ask**: Agent must ask user before using tool (default)
- **deny**: Agent cannot use tool at all

Permissions are configured:
- Globally in `opencode.jsonc` under `permission` object
- Per-agent in `agent` object with overrides
- Pattern matching for bash commands (e.g., `"git *": "allow"`)

See `PERMISSION-SYSTEM.md` for complete documentation.

### Plugin System

OpenCode plugins replace Claude Code hooks:

- **Location**: `.opencode/plugin/` directory
- **Format**: TypeScript files exporting a Plugin function
- **Events**: Handle `session.created` and other events
- **API**: Use `$` API for shell commands

Example plugin structure:

```typescript
import type { Plugin } from '@opencode-ai/core'

export default function sessionHooks(): Plugin {
  return {
    name: 'session-hooks',
    on: {
      'session.created': async ({ $ }) => {
        // First-run detection, welcome message, etc.
      }
    }
  }
}
```

### Testing Commands

To test OpenCode commands:

1. Start OpenCode: `opencode` (or `opencode <agent-name>`)
2. Run command: `/command-name`
3. Verify agent permissions are enforced correctly
4. Test with different agent profiles if needed

### Windows Compatibility

On Windows, scripts require:

- **Git Bash** or **WSL** for shell scripts
- Path handling uses forward slashes (works in Git Bash)
- MCP servers work with Node.js on Windows
- Environment variables set in shell profile

See `.scripts/README.md` for Windows-specific notes.
