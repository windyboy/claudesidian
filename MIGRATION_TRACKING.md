# Migration Tracking

**Branch:** feature/opencode-migration  
**Started:** January 6, 2026  
**Status:** Phase 2 - Permission System Refinement

---

## Progress Summary

| Phase                       | Status         | Completion |
| --------------------------- | -------------- | ---------- |
| Phase 0: Pre-Migration      | 🟢 Complete    | 100%       |
| Phase 1: Core Configuration | 🟢 Complete    | 100%       |
| Phase 2: Permission System  | ⚪ Not Started | 0%         |
| Phase 3: P0 Commands        | ⚪ Not Started | 0%         |
| Phase 4: P1-P2 Commands     | ⚪ Not Started | 0%         |
| Phase 5: GitHub Action      | ⚪ Not Started | 0%         |
| Phase 6: Windows Testing    | ⚪ Not Started | 0%         |
| Phase 7: Documentation      | ⚪ Not Started | 0%         |
| Phase 8: Testing & Cleanup  | ⚪ Not Started | 0%         |

---

## Phase 0: Pre-Migration Preparation

### Tasks

- [x] Create migration branch: `feature/opencode-migration`
- [x] Install OpenCode CLI: `bun add -g opencode-ai` (Version: 1.1.3)
- [x] Create migration tracking document (this file)
- [x] Backup current configuration (completed: 04_Archive/Claude-Code-Backup-20260106/)
- [ ] Create `OPENCODE-MIGRATION-GUIDE.md`
- [ ] Document current command usage patterns

### Verification

- [x] Branch created successfully
- [x] OpenCode CLI installed and accessible (opencode v1.1.3)
- [x] Backup files created
- [ ] Documentation templates ready

---

## Phase 1: Core Configuration (Complete ✅)

### Tasks

#### 1.1 Configuration File Creation

- [x] Create `opencode.jsonc` with verified schema
- [x] Transform hooks from `.claude/settings.json` to plugin system
- [x] Configure MCP server: gemini-vision
- [x] Set up environment variable injection
- [x] Configure agent profiles (initial version)

#### 1.2 Plugin Development

- [x] Create `.opencode/plugin/` directory
- [x] Implement `session-hooks.ts` plugin
- [x] Test plugin execution on session start
- [x] Verify shell command execution via `$` API

#### 1.3 MCP Server Configuration

- [x] Configure gemini-vision MCP server in OpenCode format
- [x] Test MCP server startup
- [x] Verify environment variable passing
- [ ] Test basic vision capabilities

#### 1.4 Permission System Initial Design

- [x] Design agent-based permission strategy (4-6 agents)
- [x] Map initial permission rules
- [x] Create `permission` object with pattern matching
- [ ] Document permission model

### Verification

**Configuration**

- [x] `opencode.jsonc` validates against schema
- [x] OpenCode loads configuration
- [x] No syntax errors or warnings

**Plugin**

- [x] Plugin loads successfully
- [x] First-run message displays
- [x] Auto-update check runs

**MCP**

- [x] MCP server starts without errors
- [x] Environment variable `GEMINI_API_KEY` accessible
- [ ] Test image analysis with sample file

**Permissions**

- [x] Permission rules documented in `AGENTS.md`
- [x] Agent profiles created
- [ ] Pattern matching tested for 10+ commands

### Notes

**January 6, 2026 - Phase 1 Complete:**

- Created `opencode.jsonc` with verified schema
- Implemented 5 agent profiles: bootstrap, thinking-partner, research-assistant, assistant, read-only
- Created permission system with global and agent-specific rules
- Configured MCP server structure (environment to be added via CLI)
- Created `.opencode/plugin/session-hooks.ts` plugin
- Plugin implements:
  - First-run detection (FIRST_RUN file check)
  - Welcome message display
  - Automatic npm update checking
- Created `.opencode/plugin/README.md` with plugin documentation
- ✅ OpenCode CLI installed successfully (v1.1.3)
- ✅ Configuration validated and loads correctly
- ✅ OpenCode TUI starts successfully
- Note: MCP configuration format uses command string, not array
- Note: Plugin array removed - will configure MCP via CLI
- Note: Command directory auto-detected from `.opencode/command/`
- Pending: Test basic vision capabilities with MCP
- Pending: Document permission model in AGENTS.md

---

## Phase 2: Permission System Refinement

### Tasks

#### 2.1 Command Analysis

- [ ] Analyze all 17 command files for tool usage
- [ ] Create tool usage matrix
- [ ] Identify unique permission requirements per command

#### 2.2 Agent Profile Design

- [ ] Define 4-6 agent profiles based on security needs
- [ ] Create detailed permission matrix per agent
- [ ] Document agent responsibilities and use cases
- [ ] Map commands to agents

#### 2.3 Permission Rules Implementation

- [ ] Implement global permissions in `opencode.jsonc`
- [ ] Implement agent-specific overrides
- [ ] Test pattern matching for all allowed commands
- [ ] Verify deny rules work correctly

#### 2.4 Permission Testing

- [ ] Test each agent profile with representative commands
- [ ] Verify `ask` prompts appear for unspecified tools
- [ ] Verify `allow` rules work for permitted operations
- [ ] Verify `deny` rules block unauthorized tools
- [ ] Document permission edge cases

---

## Phase 3: P0 Command Migration

### P0 Commands

- [ ] **thinking-partner** - Core reasoning assistance
- [ ] **research-assistant** - Information gathering
- [ ] **init-bootstrap** - Setup wizard
- [ ] **daily-review** - Daily workflow
- [ ] **create-command** - Command creation

### Tasks

For each P0 command:

- [ ] Read current `.claude/commands/[name].md`
- [ ] Create `.opencode/command/[name].md`
- [ ] Convert frontmatter
- [ ] Test with sample queries
- [ ] Verify tool restrictions

### Pattern Establishment

- [ ] Document migration pattern for remaining commands
- [ ] Create migration checklist
- [ ] Document common issues and solutions
- [ ] Update `AGENTS.md` with OpenCode command guidelines

---

## Phase 4: P1-P2 Command Migration

### P1 Commands (High Priority)

- [ ] **inbox-processor** - Inbox management
- [ ] **pull-request** - PR creation assistance
- [ ] **release** - Release workflow
- [ ] **weekly-synthesis** - Weekly review
- [ ] **upgrade** - Update management
- [ ] **add-frontmatter** - Metadata addition
- [ ] **download-attachment** - Attachment handling

### P2 Commands (Medium Priority)

- [ ] **de-ai-ify** - Content transformation
- [ ] **install-claudesidian-command** - Installation
- [ ] **task-manager** - Task tracking
- [ ] **template-manager** - Template system
- [ ] **vault-stats** - Analytics

### Tasks

- [ ] Migrate all P1 commands
- [ ] Migrate all P2 commands
- [ ] Test all 17 commands end-to-end
- [ ] Compare behavior to Claude Code version
- [ ] Document any discrepancies

---

## Phase 5: GitHub Action Conversion

### Tasks

- [ ] Copy workflow to `.github/workflows/opencode.yml`
- [ ] Update action to `anomalyco/opencode/github@latest`
- [ ] Update triggers (change `@claude` to `/opencode`)
- [ ] Configure `model` and `permission` settings
- [ ] Test with sample issue
- [ ] Test with sample PR comment

---

## Phase 6: Windows Compatibility Testing

### Tasks

#### 6.1 Shell Script Testing

- [ ] Test `vault-stats.sh`
- [ ] Test `transcript-extract.sh`
- [ ] Test `firecrawl-scrape.sh`
- [ ] Test `firecrawl-batch.sh`
- [ ] Test with Git Bash

#### 6.2 Path Handling Verification

- [ ] Test path separator handling
- [ ] Verify file paths work in commands
- [ ] Test UNC paths (if applicable)
- [ ] Test long paths (> 260 chars)

#### 6.3 MCP Server Testing

- [ ] Start gemini-vision MCP server on Windows
- [ ] Test environment variable passing
- [ ] Verify image analysis works
- [ ] Test file paths with spaces

#### 6.4 Compatibility Fixes

- [ ] Fix bash-isms in shell scripts
- [ ] Add path normalization functions
- [ ] Handle Windows-specific edge cases

#### 6.5 Windows Documentation

- [ ] Document Windows-specific setup steps
- [ ] Document known limitations
- [ ] Create troubleshooting guide
- [ ] Add Windows testing notes to migration guide

---

## Phase 7: Documentation Updates

### Tasks

#### 7.1 README Updates

- [ ] Update installation instructions for OpenCode
- [ ] Replace Claude Code references with OpenCode
- [ ] Update quick start guide
- [ ] Update command examples

#### 7.2 New Documentation

- [ ] Create `OPENCODE-BOOTSTRAP.md` from `CLAUDE-BOOTSTRAP.md`
- [ ] Create `MIGRATION-GUIDE.md` for users migrating from Claude Code
- [ ] Create `OPENCODE-COMMANDS.md` with all OpenCode commands
- [ ] Create `PERMISSION-SYSTEM.md` explaining permission model

#### 7.3 AGENTS.md Updates

- [ ] Update build/lint/format commands for OpenCode
- [ ] Update code style guidelines for OpenCode
- [ ] Update Git workflow for OpenCode
- [ ] Add OpenCode-specific patterns
- [ ] Update testing approaches

#### 7.4 Documentation Cleanup

- [ ] Remove Claude Code-specific documentation
- [ ] Archive old documentation to `04_Archive/`
- [ ] Update all cross-references
- [ ] Verify all links work

#### 7.5 User Guides

- [ ] Create getting started guide for OpenCode
- [ ] Create command reference guide
- [ ] Create permission configuration guide
- [ ] Create troubleshooting guide

---

## Phase 8: Testing & Cleanup

### Tasks

#### 8.1 End-to-End Testing

- [ ] Test complete workflow from setup to daily use
- [ ] Test all 17 commands sequentially
- [ ] Verify permissions work correctly
- [ ] Test error handling
- [ ] Test edge cases

#### 8.2 MCP Server Testing

- [ ] Test gemini-vision with sample images
- [ ] Test PDF analysis
- [ ] Test video analysis (if applicable)
- [ ] Test error scenarios
- [ ] Verify performance

#### 8.3 GitHub Action Testing

- [ ] Test issue response
- [ ] Test PR comment response
- [ ] Test PR review response
- [ ] Test scheduled triggers (if configured)
- [ ] Verify permissions

#### 8.4 Regression Testing

- [ ] Test all commands against original behavior
- [ ] Verify output format matches
- [ ] Test file creation patterns
- [ ] Test integration with Obsidian
- [ ] Verify Git workflows

#### 8.5 Cleanup

- [ ] Remove `.claude/` directory (except MCP server)
- [ ] Remove `.claude/settings.json`
- [ ] Remove `.claude/claude_config.json`
- [ ] Update `.gitignore` if needed
- [ ] Archive old configuration to `04_Archive/`

#### 8.6 Final Validation

- [ ] Run `pnpm lint:check` - should pass
- [ ] Run `pnpm format:check` - should pass
- [ ] Test with sample user scenario
- [ ] Create migration checklist verification
- [ ] Generate final report

#### 8.7 Rollback Preparation

- [ ] Document rollback procedures
- [ ] Keep backup of configuration files
- [ ] Create git tag: `v0.14.0-opencode-migration`
- [ ] Document known limitations

---

## Issues and Challenges

### Issues Found

**Phase 1 Configuration Issues:**

- ✅ Trailing commas in JSON caused validation failures - Fixed
- ✅ MCP `command` array vs string confusion - Resolved (use string)
- ✅ MCP `environment` format confusion - Resolved (remove, use CLI auth)
- ✅ Plugin loading from npm vs local - Resolved (remove from config)
- ✅ Command directory field causing errors - Resolved (remove, auto-detected)

### Workarounds Implemented

**Phase 1:**

- MCP server configured without environment variables (to be added via `opencode mcp auth`)
- Plugin system configured to auto-detect plugins from `.opencode/plugin/`
- Commands auto-detected from `.opencode/command/` directory

---

## Decisions Made

**January 6, 2026:**

- ✅ Created separate migration branch to isolate changes
- ✅ Documented all progress in MIGRATION_TRACKING.md
- ✅ Installed OpenCode CLI via bun (v1.1.3)
- ✅ Decided to defer MCP environment variables to CLI auth instead of config file
- ✅ Decided to remove plugin array and rely on auto-detection
- ✅ Decided to remove command directory config (auto-detected)

---

## Next Steps

**Immediate (Phase 2):**

1. Analyze all 17 command files for tool usage patterns
2. Create comprehensive tool usage matrix
3. Map commands to appropriate agent profiles
4. Refine permission rules based on actual command needs
5. Test permission enforcement

---

## Rollback Status

**Current State:** No rollback needed  
**Last Safe Point:** Phase 1 commit  
**Rollback Command:** `git checkout <commit-hash>`

---

**Last Updated:** January 6, 2026  
**Updated By:** Migration System
