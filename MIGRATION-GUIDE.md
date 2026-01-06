# Migration Guide: Claude Code to OpenCode

This guide helps you migrate your claudesidian vault from Claude Code to OpenCode.

## Overview

OpenCode is the successor to Claude Code, providing improved permission management,
agent profiles, and a more flexible plugin system. This migration preserves all your
commands and workflows while upgrading to the new system.

## Prerequisites

- OpenCode CLI installed: `bun add -g opencode-ai` (or `npm install -g opencode-ai`)
- Your vault backed up (recommended)
- Git repository initialized (for version control)

## Migration Steps

### Step 1: Install OpenCode CLI

```bash
# Using bun (recommended)
bun add -g opencode-ai

# Or using npm
npm install -g opencode-ai

# Verify installation
opencode --version
```

### Step 2: Backup Your Configuration

```bash
# Create backup directory
mkdir -p 04_Archive/Claude-Code-Backup-$(date +%Y%m%d)

# Backup Claude Code configuration
cp -r .claude 04_Archive/Claude-Code-Backup-$(date +%Y%m%d)/
```

### Step 3: Verify OpenCode Configuration

The migration has already created `opencode.jsonc` with:

- 5 agent profiles (bootstrap, thinking-partner, research-assistant, assistant, read-only)
- Permission system configuration
- MCP server configuration (gemini-vision)
- Plugin system setup

Verify the configuration loads:

```bash
opencode config validate
```

### Step 4: Configure MCP Server Authentication

If you're using the Gemini Vision MCP server:

```bash
# Add MCP server with authentication
opencode mcp add gemini-vision <server-url>

# Set environment variable
opencode mcp auth gemini-vision GEMINI_API_KEY
```

### Step 5: Test Commands

All commands have been migrated to `.opencode/command/`. Test a few:

```bash
# Start OpenCode
opencode

# Test commands
/thinking-partner
/daily-review
/research-assistant
```

### Step 6: Update Your Workflow

**Command Usage:**

- Old: `claude run /command-name`
- New: `/command-name` (in OpenCode TUI)

**MCP Server Management:**

- Old: `claude mcp add <server>`
- New: `opencode mcp add <server>`

**Configuration:**

- Old: `.claude/settings.json`
- New: `opencode.jsonc`

### Step 7: Clean Up (Optional)

After verifying everything works, you can optionally remove Claude Code configuration:

```bash
# Only remove if you're confident everything works
# Keep .claude/mcp-servers/ if you have custom MCP servers
rm -rf .claude/settings.json
rm -rf .claude/claude_config.json
```

**Note**: The `.claude/mcp-servers/` directory is preserved as MCP servers work with both systems.

## Key Differences

### Permission System

**Claude Code:**
- Per-command `allowed-tools` in frontmatter
- Simple allow/deny per tool

**OpenCode:**
- Agent-based permission system
- Global permissions with agent overrides
- Pattern matching for bash commands
- Three levels: allow, ask, deny

### Command Structure

**Claude Code:**
- Commands in `.claude/commands/`
- Frontmatter with `allowed-tools`

**OpenCode:**
- Commands in `.opencode/command/`
- Frontmatter with `agent` field
- Agent permissions handle tool access

### Plugin System

**Claude Code:**
- Hooks in `.claude/settings.json`
- JavaScript hooks

**OpenCode:**
- Plugins in `.opencode/plugin/`
- TypeScript plugins with event handlers
- Auto-detected from directory

## Agent Profiles

OpenCode uses 5 agent profiles with different permission levels:

1. **bootstrap**: Full access for setup and system operations
2. **thinking-partner**: Read-only for exploration
3. **research-assistant**: Read/write with web access (asks for consent)
4. **assistant**: Standard permissions with safety checks
5. **read-only**: Minimal permissions for safe review

See `PERMISSION-SYSTEM.md` for detailed permission information.

## Command Mapping

All 14 commands have been migrated with appropriate agent assignments:

| Command | Agent | Key Permissions |
|---------|-------|----------------|
| thinking-partner | thinking-partner | Read, Glob (no write/bash) |
| research-assistant | research-assistant | Read, Write, Edit, Glob, WebFetch (ask) |
| init-bootstrap | bootstrap | All tools allowed |
| daily-review | read-only | Read, Glob only |
| create-command | bootstrap | All tools allowed |
| inbox-processor | read-only | Read, Glob (no write/bash) |
| pull-request | bootstrap | All tools allowed |
| release | bootstrap | All tools allowed |
| weekly-synthesis | read-only | Read, Glob only |
| upgrade | bootstrap | All tools allowed |
| add-frontmatter | assistant | Read, Write, Edit, Glob |
| download-attachment | research-assistant | Read, Write, Bash (curl, wget) |
| de-ai-ify | assistant | Read, Write, Edit |
| install-claudesidian-command | bootstrap | Read, Write, Bash (shell config) |

## Troubleshooting

### OpenCode CLI Not Found

```bash
# Check if installed
which opencode

# Reinstall if needed
bun add -g opencode-ai
```

### Commands Not Working

1. Verify command exists in `.opencode/command/`
2. Check frontmatter has `agent` field
3. Verify agent profile exists in `opencode.jsonc`
4. Check permissions in `PERMISSION-SYSTEM.md`

### Permission Issues

If a command needs more permissions:

1. Check current agent assignment in command frontmatter
2. Review permissions in `opencode.jsonc`
3. Consider switching to a different agent profile
4. Or update permissions for the current agent

### MCP Server Issues

```bash
# List configured MCP servers
opencode mcp list

# Check authentication
opencode mcp auth list

# Re-add if needed
opencode mcp add <server-name> <url>
```

## Windows Users

On Windows, you'll need:

- **Git Bash** or **WSL** for shell scripts
- Scripts use forward slashes (work in Git Bash)
- MCP servers work with Node.js on Windows
- Environment variables in shell profile

See `.scripts/README.md` for Windows-specific notes.

## Rollback

If you need to rollback to Claude Code:

1. Restore backup: `cp -r 04_Archive/Claude-Code-Backup-*/ .claude/`
2. Use Claude Code as before
3. OpenCode configuration won't interfere

## Getting Help

- Check `PERMISSION-SYSTEM.md` for permission details
- Review `AGENTS.md` for development guidelines
- See `OPENCODE-BOOTSTRAP.md` for workflow guidance
- Check OpenCode documentation: https://opencode.ai/docs

## Next Steps

After migration:

1. Test all your commonly used commands
2. Familiarize yourself with agent profiles
3. Review permission system documentation
4. Customize agent permissions if needed
5. Update any automation scripts that reference Claude Code

---

**Migration Status**: Complete ✅  
**Last Updated**: January 6, 2026

