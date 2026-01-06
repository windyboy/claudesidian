# Migration Tracking

**Branch:** feature/opencode-migration
**Started:** January 6, 2026
**Status:** Phase 2 - Permission System Refinement (75% Complete)

---

## Progress Summary

| Phase                       | Status               | Completion |
| --------------------------- | -------------------- | ---------- |
| Phase 0: Pre-Migration      | 🟢 Complete          | 100%       |
| Phase 1: Core Configuration | 🟢 Complete          | 100%       |
| Phase 2: Permission System  | 🟡 In Progress (75%) | 75%        |
| Phase 3: P0 Commands        | ⚪ Not Started       | 0%         |
| Phase 4: P1-P2 Commands     | ⚪ Not Started       | 0%         |
| Phase 5: GitHub Action      | ⚪ Not Started       | 0%         |
| Phase 6: Windows Testing    | ⚪ Not Started       | 0%         |
| Phase 7: Documentation      | ⚪ Not Started       | 0%         |
| Phase 8: Testing & Cleanup  | ⚪ Not Started       | 0%         |

---

## Current Status Summary

**Date:** January 6, 2026
**Branch:** feature/opencode-migration
**Status:** Phase 1 Complete ✅ - Ready for Phase 2

### What We've Accomplished

**Phase 0: Pre-Migration Preparation (100% Complete)**

- Created migration branch: `feature/opencode-migration`
- Installed OpenCode CLI v1.1.3 via `bun add -g opencode-ai`
- Created migration tracking document (this file)
- Backed up Claude Code configuration to `04_Archive/Claude-Code-Backup-20260106/`
- Created `OPENCODE-MIGRATION-PLAN.md` - Comprehensive 8-phase migration plan (4-8 weeks)
- Created `AGENTS.md` - Agent development guidelines for OpenCode
- Committed initial migration documents

**Phase 1: Core Configuration (100% Complete)**

- Created `opencode.jsonc` - Main OpenCode configuration file with:
  - Global permission system (ask/allow/deny)
  - 5 agent profiles: bootstrap, thinking-partner, research-assistant, assistant, read-only
  - MCP server structure for gemini-vision
  - Note: MCP environment variables configured via CLI, not config file
- Created Plugin System:
  - `.opencode/plugin/session-hooks.ts` - Replaces Claude Code hooks
    - First-run detection (FIRST_RUN file check)
    - Welcome message display
    - Auto npm update checking
  - `.opencode/plugin/package.json` - Plugin package definition
  - `.opencode/plugin/README.md` - Plugin documentation
- Fixed JSON Validation Issues:
  - Removed all trailing commas
  - Changed MCP `command` from array to string format
  - Removed MCP `environment` object (use CLI auth instead)
  - Removed plugin array (auto-detection works)
  - Removed command directory field (auto-detected from `.opencode/command/`)
- Verified Configuration:
  - OpenCode CLI starts successfully
  - Configuration loads without errors
  - TUI interface displays correctly

### Git Commits Made

1. Initial migration plan and tracking documents
2. Phase 1 completion: core configuration and plugin system

### Working Configuration

- `opencode.jsonc` - Validated and working
- `.opencode/plugin/session-hooks.ts` - Implemented
- MCP server configured (environment via CLI)

### Key Technical Decisions

1. **OpenCode Configuration Format:**
   - No trailing commas in JSON
   - MCP command as string, not array: `"command": "node .claude/mcp-servers/gemini-vision.mjs"`
   - MCP environment variables configured via `opencode mcp auth`, not config file
   - Plugins auto-detected from `.opencode/plugin/` directory
   - Commands auto-detected from `.opencode/command/` directory

2. **Permission System Design:**
   - Global `permission` object with ask/allow/deny
   - Agent-specific overrides in `agent` object
   - Pattern matching for bash commands: `"git *": "allow"`
   - 5 agent profiles defined:
     - **bootstrap**: Full access, all tools allowed
     - **thinking-partner**: Read-only with search capabilities
     - **research-assistant**: Web access via firecrawl
     - **assistant**: Standard permissions with ask for risky operations
     - **read-only**: Minimal permissions, mostly read access

3. **Plugin System:**
   - TypeScript files in `.opencode/plugin/`
   - Export Plugin function with event handlers
   - Use `$` API for shell commands
   - Handle `session.created` event for hooks

4. **MCP Integration:**
   - Server defined in config with command string
   - Environment variables managed via `opencode mcp auth`
   - Command: `opencode mcp add gemini-vision <url>`

### Files Created/Modified

**New Files:**

```
OPENCODE-MIGRATION-PLAN.md
MIGRATION_TRACKING.md
AGENTS.md
opencode.jsonc
.opencode/plugin/session-hooks.ts
.opencode/plugin/package.json
.opencode/plugin/README.md
04_Archive/Claude-Code-Backup-20260106/
```

**Files Not Yet Created:**

```
.opencode/command/ (directory - will be created in Phase 3)
.open-mcp-auth/ (MCP auth state - managed by CLI)
```

### Next Phase (Phase 2: Permission System Refinement)

**Immediate Tasks:**

1. Analyze all 17 command files for tool usage
2. Create tool usage matrix
3. Map commands to appropriate agent profiles
4. Refine permission rules based on actual command needs
5. Test permission enforcement

**Commands to Analyze (17 total):**

**P0 Commands (Phase 3 - Critical Path):**

1. `thinking-partner.md` - Core reasoning assistance
2. `research-assistant.md` - Information gathering
3. `init-bootstrap.md` - Setup wizard
4. `daily-review.md` - Daily workflow
5. `create-command.md` - Command creation

**P1 Commands (Phase 4 - High Priority):** 6. `inbox-processor.md` - Inbox management 7. `pull-request.md` - PR creation assistance 8. `release.md` - Release workflow 9. `weekly-synthesis.md` - Weekly review 10. `upgrade.md` - Update management 11. `add-frontmatter.md` - Metadata addition 12. `download-attachment.md` - Attachment handling

**P2 Commands (Phase 4 - Medium Priority):** 13. `de-ai-ify.md` - Content transformation 14. `install-claudesidian-command.md` - Installation 15. `task-manager.md` - Task tracking 16. `template-manager.md` - Template system 17. `vault-stats.md` - Analytics

### Migration Plan Reference

**Total Timeline:** 4-8 weeks
**Critical Path:** Phase 1 → 2 → 3 → 5 → 8

**Phase Breakdown:**

- Phase 0: Pre-Migration (Complete ✅)
- Phase 1: Core Configuration (Complete ✅)
- Phase 2: Permission System Refinement (Next - 0%)
- Phase 3: P0 Commands (Week 2-3)
- Phase 4: P1-P2 Commands (Week 3-4)
- Phase 5: GitHub Action (Week 4-5)
- Phase 6: Windows Testing (Week 5-6)
- Phase 7: Documentation (Week 6-7)
- Phase 8: Testing & Cleanup (Week 7-8)

### Rollback Point

**Last Safe Commit:** `e5f7a9a` - "feat(Phase1): complete core configuration"

**Rollback if needed:**

```bash
git checkout e5f7a9a
```

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

### Tool Usage Matrix

**Analysis Date:** January 6, 2026

**Commands Analyzed:** 14 (of 17 listed in plan)

- 3 files not found: task-manager.md, template-manager.md, vault-stats.md

#### Tool Usage by Command

| Command                      | Read | Write | Edit | Bash | Glob | Grep | WebFetch | MCP | Task | MultiEdit |
| ---------------------------- | ---- | ----- | ---- | ---- | ---- | ---- | -------- | --- | ---- | --------- |
| thinking-partner             | ✅   | ❌    | ❌   | ❌   | ❌   | ❌   | ❌       | ❌  | ❌   | ❌        |
| research-assistant           | ✅   | ❌    | ❌   | ❌   | ❌   | ❌   | ❌       | ❌  | ❌   | ❌        |
| init-bootstrap               | ✅   | ✅    | ❌   | ✅   | ❌   | ❌   | ✅       | ❌  | ✅   | ✅        |
| daily-review                 | ✅   | ❌    | ❌   | ❌   | ❌   | ❌   | ❌       | ❌  | ❌   | ❌        |
| create-command               | ✅   | ✅    | ✅   | ⚠️\* | ❌   | ❌   | ❌       | ❌  | ❌   | ❌        |
| inbox-processor              | ✅   | ❌    | ❌   | ❌   | ✅   | ❌   | ❌       | ❌  | ❌   | ❌        |
| pull-request                 | ✅   | ❌    | ❌   | ✅   | ❌   | ❌   | ❌       | ❌  | ❌   | ❌        |
| release                      | ✅   | ✅    | ✅   | ✅   | ❌   | ✅   | ❌       | ❌  | ❌   | ✅        |
| weekly-synthesis             | ✅   | ❌    | ❌   | ❌   | ✅   | ❌   | ❌       | ❌  | ❌   | ❌        |
| upgrade                      | ✅   | ✅    | ✅   | ✅   | ✅   | ✅   | ✅       | ❌  | ❌   | ✅        |
| add-frontmatter              | ✅   | ✅    | ✅   | ❌   | ✅   | ❌   | ❌       | ❌  | ❌   | ❌        |
| download-attachment          | ✅   | ✅    | ❌   | ✅   | ❌   | ❌   | ❌       | ✅  | ❌   | ❌        |
| de-ai-ify                    | ✅   | ✅    | ✅   | ❌   | ❌   | ❌   | ❌       | ❌  | ❌   | ❌        |
| install-claudesidian-command | ✅   | ✅    | ❌   | ✅   | ❌   | ❌   | ❌       | ❌  | ❌   | ❌        |

**⚠️ Note:** create-command has restricted Bash access: `Bash(ls:*, mkdir:*)` only

#### Tool Usage Patterns

**Tools Used by Commands:**

- **Read**: 14/14 (100%)
- **Write**: 9/14 (64%)
- **Edit**: 7/14 (50%)
- **Bash**: 7/14 (50%)
- **Glob**: 5/14 (36%)
- **Grep**: 2/14 (14%)
- **WebFetch**: 2/14 (14%)
- **MCP**: 1/14 (7%) - gemini-vision
- **Task**: 1/14 (7%)
- **MultiEdit**: 3/14 (21%)

#### Command Categories by Tool Needs

**🟢 Read-Only (No Bash/Write):**

- thinking-partner
- research-assistant
- daily-review
- weekly-synthesis
- inbox-processor

**🟡 Standard Read+Write (No Bash):**

- add-frontmatter
- de-ai-ify

**🟠 Full Access (Read+Write+Edit+Bash):**

- init-bootstrap
- release
- upgrade
- pull-request
- download-attachment
- install-claudesidian-command

**🔵 Restricted Bash:**

- create-command (limited to ls, mkdir)

#### Command to Agent Mapping

Based on tool usage, commands map to agents as follows:

**read-only agent:**

- thinking-partner
- research-assistant
- daily-review
- weekly-synthesis
- inbox-processor

**assistant agent:**

- add-frontmatter
- de-ai-ify

**bootstrap agent:**

- init-bootstrap
- release
- upgrade
- pull-request
- download-attachment
- install-claudesidian-command
- create-command

**research-assistant agent:**

- (commands with WebFetch but not full bash access)
- (no commands fit this exact profile yet)

### Tasks

#### 2.1 Command Analysis ✅ COMPLETE

- [x] Analyze all 14 command files for tool usage
- [x] Create tool usage matrix
- [x] Identify unique permission requirements per command

#### 2.2 Agent Profile Design ✅ COMPLETE

- [x] Define 5 agent profiles based on security needs
- [x] Create detailed permission matrix per agent (PERMISSION-SYSTEM.md)
- [x] Document agent responsibilities and use cases (PERMISSION-SYSTEM.md)
- [x] Map commands to agents (initial mapping created)

#### 2.3 Permission Rules Implementation ✅ COMPLETE

- [x] Implement global permissions in `opencode.jsonc`
- [x] Implement agent-specific overrides
- [ ] Test pattern matching for all allowed commands
- [ ] Verify deny rules work correctly

#### 2.4 Permission Testing

- [ ] Test each agent profile with representative commands
- [ ] Verify `ask` prompts appear for unspecified tools
- [ ] Verify `allow` rules work for permitted operations
- [ ] Verify `deny` rules block unauthorized tools
- [ ] Document permission edge cases

### Notes

**January 6, 2026 - Phase 2 Progress (75%):**

- Created comprehensive tool usage matrix for all 14 commands
- Created PERMISSION-SYSTEM.md with detailed documentation:
  - 5 agent profiles with specific permissions
  - Tool descriptions and usage patterns
  - Security best practices
  - Common command mappings
- Updated opencode.jsonc with refined permissions:
  - **bootstrap agent**: All tools allowed, bash patterns for git/npm/file ops
  - **thinking-partner agent**: Read-only, Glob allowed, no bash
  - **research-assistant agent**: Read+Write+Edit+Glob, bash for downloads only
  - **assistant agent**: Read+Write+Edit+Glob, ask for bash/web
  - **read-only agent**: Read+Glob only, no write/edit/bash
- Added comprehensive bash permission patterns:
  - Git operations (status, diff, log, add, commit, push, pull, checkout, branch, tag)
  - Package managers (npm, pnpm)
  - File operations (ls, cat, find, mkdir, cp, mv)
  - Search tools (grep)
  - Safe operations (date, pwd, echo, which)
- Added file permission patterns:
  - Denied: .env files, \*.pem files
  - Ask: \*.pem files
  - Allowed: _.md, _.mjs, _.sh, _.json, _.ts, _.tsx, \*.js
- Configured tool permissions:
  - Glob, Grep: allow (safe operations)
  - MultiEdit: ask (powerful tool)
  - Task: ask (sub-agent)
  - WebFetch: ask (network access)
  - Write, Edit: ask (file modifications)
- OpenCode CLI loads configuration successfully
- Remaining work: Test permissions with actual commands

**Key Decisions:**

1. Research assistant renamed to maintain consistency: The agent profile exists but no commands map to it directly
2. thinking-partner and read-only both have Glob access for file discovery
3. Bootstrap agent denies dangerous bash patterns (rm -rf /, etc.)
4. Write and Edit default to "ask" at global level for safety
5. Research assistant has WebFetch set to "ask" for user consent

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
