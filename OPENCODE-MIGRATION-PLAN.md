# OpenCode Migration Refactor Plan

**Project:** Claudesidian v0.13.1 → OpenCode  
**Based on:** Migration Report (Jan 6, 2026)  
**Risk Level:** MEDIUM  
**Estimated Duration:** 4-8 weeks  
**Status:** IN PROGRESS

---

## Executive Summary

The migration report confirms **0 CRITICAL BLOCKERS** - all Claude Code features have verified OpenCode support. The primary challenges are semantic mapping and implementation complexity.

### Key Migration Requirements

1. **Configuration Transformation**: `.claude/settings.json` → `opencode.jsonc`
2. **Permission System Redesign**: Per-command `allowed-tools` → Global/agent `permission` rules
3. **Command Migration**: 17 commands with frontmatter conversion
4. **Plugin Implementation**: Hooks system → OpenCode plugins
5. **GitHub Action**: `anthropic/claude-code-action@v1` → `anomalyco/opencode/github@latest`
6. **Windows Compatibility**: Validate shell scripts and path handling

---

## Phase 0: Pre-Migration Preparation

### Tasks

- [x] Create migration branch
- [ ] Install OpenCode CLI: `npm install -g @opencode-ai/cli`
- [x] Create migration tracking document
- [ ] Backup current configuration
- [ ] Create `OPENCODE-MIGRATION-GUIDE.md`
- [ ] Document current command usage patterns

### Verification

- [x] Branch created successfully
- [ ] OpenCode CLI installed and accessible
- [ ] Backup files created
- [ ] Documentation templates ready

---

## Phase 1: Core Configuration (Week 1)

### Objectives

- Create `opencode.jsonc` configuration
- Implement session hooks plugin
- Configure MCP servers
- Test basic OpenCode functionality

### Tasks

#### 1.1 Configuration File Creation

- [ ] Create `opencode.jsonc` with verified schema
- [ ] Transform hooks from `.claude/settings.json` to plugin system
- [ ] Configure MCP server: gemini-vision
- [ ] Set up environment variable injection
- [ ] Configure agent profiles (initial version)

#### 1.2 Plugin Development

- [ ] Create `.opencode/plugin/` directory
- [ ] Implement `session-hooks.ts` plugin:
  - First-run detection (FIRST_RUN file check)
  - Welcome message display
  - Auto-update checking via npm script
- [ ] Test plugin execution on session start
- [ ] Verify shell command execution via `$` API

#### 1.3 MCP Server Configuration

- [ ] Configure gemini-vision MCP server in OpenCode format
- [ ] Test MCP server startup
- [ ] Verify environment variable passing
- [ ] Test basic vision capabilities

#### 1.4 Permission System Initial Design

- [ ] Design agent-based permission strategy (4-6 agents)
- [ ] Map initial permission rules:
  - `bootstrap` - Full access (Read, Write, Edit, Bash, Webfetch, Task)
  - `assistant` - Standard (Read, Write, Edit, Bash, Webfetch)
  - `read-only` - Analysis (Read only)
  - `research` - Web access (Read, Write, Edit, Bash, Webfetch, Websearch)
- [ ] Create `permission` object with pattern matching
- [ ] Document permission model

### Verification

**Configuration**

- [ ] `opencode.jsonc` validates against schema
- [ ] OpenCode loads configuration: `opencode config validate`
- [ ] No syntax errors or warnings

**Plugin**

- [ ] Plugin loads successfully
- [ ] First-run message displays
- [ ] Auto-update check runs

**MCP**

- [ ] MCP server starts without errors
- [ ] Environment variable `GEMINI_API_KEY` accessible
- [ ] Test image analysis with sample file

**Permissions**

- [ ] Permission rules documented in `AGENTS.md`
- [ ] Agent profiles created
- [ ] Pattern matching works

---

## Phase 2: Permission System Refinement (Week 1-2)

### Objectives

- Design comprehensive permission strategy
- Map all 17 commands to agent profiles
- Implement pattern-based rules
- Test permission enforcement

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

### Verification

- [ ] All 17 commands analyzed
- [ ] Tool usage matrix complete
- [ ] 4-6 agent profiles defined
- [ ] Permission rules load without errors
- [ ] Pattern matching tested for 10+ commands
- [ ] All agent profiles tested

---

## Phase 3: P0 Command Migration (Week 2-3)

### Objectives

- Migrate 5 highest-priority commands
- Test functionality and behavior
- Verify tool usage matches expected patterns
- Establish migration pattern for remaining commands

### P0 Commands

1. **thinking-partner** - Core reasoning assistance
2. **research-assistant** - Information gathering
3. **init-bootstrap** - Setup wizard (critical path)
4. **daily-review** - Daily workflow
5. **create-command** - Command creation

### Tasks

For each P0 command:

- [ ] Read current `.claude/commands/[name].md`
- [ ] Create `.opencode/command/[name].md`
- [ ] Convert frontmatter (remove `allowed-tools`, add `agent`)
- [ ] Test with sample queries
- [ ] Verify tool restrictions

### Pattern Establishment

- [ ] Document migration pattern for remaining commands
- [ ] Create migration checklist
- [ ] Document common issues and solutions
- [ ] Update `AGENTS.md` with OpenCode command guidelines

### Verification

For each P0 command:

- [ ] Command loads successfully
- [ ] Agent profile assigned correctly
- [ ] Tool permissions enforced
- [ ] Functionality matches original behavior
- [ ] No syntax errors in frontmatter

- [ ] Migration checklist complete
- [ ] Common issues documented
- [ ] `AGENTS.md` updated

---

## Phase 4: P1-P2 Command Migration (Week 3-4)

### Objectives

- Migrate remaining 12 commands
- Test behavioral compatibility
- Document any tool usage differences
- Complete command migration

### P1 Commands (High Priority)

6. **inbox-processor** - Inbox management
7. **pull-request** - PR creation assistance
8. **release** - Release workflow
9. **weekly-synthesis** - Weekly review
10. **upgrade** - Update management
11. **add-frontmatter** - Metadata addition
12. **download-attachment** - Attachment handling

### P2 Commands (Medium Priority)

13. **de-ai-ify** - Content transformation
14. **install-claudesidian-command** - Installation
15. **task-manager** - Task tracking
16. **template-manager** - Template system
17. **vault-stats** - Analytics

### Tasks

#### 4.1 P1 Command Migration

- [ ] Migrate all 6 P1 commands using established pattern
- [ ] Test functionality
- [ ] Verify permissions
- [ ] Document any behavioral differences

#### 4.2 P2 Command Migration

- [ ] Migrate all 5 P2 commands using established pattern
- [ ] Test functionality
- [ ] Verify permissions
- [ ] Document any behavioral differences

#### 4.3 Behavioral Testing

- [ ] Test all 17 commands end-to-end
- [ ] Compare behavior to Claude Code version
- [ ] Document any discrepancies
- [ ] Fix critical behavioral differences

#### 4.4 Command Documentation

- [ ] Update command README in `.opencode/command/README.md`
- [ ] Document command usage with OpenCode
- [ ] Create migration notes for users
- [ ] Update main README with OpenCode commands

### Verification

- [ ] All 17 commands migrated
- [ ] All commands tested
- [ ] Behavior compared to original
- [ ] Discrepancies documented
- [ ] Command README complete

---

## Phase 5: GitHub Action Conversion (Week 4-5)

### Objectives

- Convert GitHub Action from Claude Code to OpenCode
- Update triggers and configuration
- Test with sample issues/PRs
- Update CI/CD permissions

### Tasks

#### 5.1 Workflow File Conversion

- [ ] Copy `.github/workflows/claude.yml` to `.github/workflows/opencode.yml`
- [ ] Update action to `anomalyco/opencode/github@latest`
- [ ] Update triggers (change `@claude` to `/opencode` or `/oc`)
- [ ] Configure `model` and `permission` settings
- [ ] Update environment variable references

#### 5.2 Permission Configuration

- [ ] Set GitHub Action permissions
- [ ] Configure OpenCode permissions in workflow
- [ ] Map Claude Code allowed-tools to OpenCode permissions

#### 5.3 Workflow Testing

- [ ] Test with sample issue
- [ ] Test with sample PR comment
- [ ] Verify action responds correctly
- [ ] Check permissions work
- [ ] Test error handling

#### 5.4 Documentation Updates

- [ ] Update `CONTRIBUTING.md` with OpenCode triggers
- [ ] Document action usage in README
- [ ] Create GitHub integration guide
- [ ] Update developer workflow documentation

### Verification

- [ ] Workflow file syntax valid
- [ ] Action reference correct
- [ ] Triggers updated
- [ ] Issue test successful
- [ ] PR test successful

---

## Phase 6: Windows Compatibility Testing (Week 5-6)

### Objectives

- Test all shell scripts on Windows
- Verify path handling
- Test MCP server on Windows
- Fix Windows-specific issues

### Tasks

#### 6.1 Shell Script Testing

- [ ] Test all scripts in `.scripts/`:
  - `vault-stats.sh`
  - `transcript-extract.sh`
  - `firecrawl-scrape.sh`
  - `firecrawl-batch.sh`
- [ ] Test with Git Bash
- [ ] Test with PowerShell (if applicable)
- [ ] Document compatibility status per script

#### 6.2 Path Handling Verification

- [ ] Test path separator handling (backslash vs forward slash)
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

### Verification

- [ ] All scripts run without errors on Windows
- [ ] Forward slashes work
- [ ] Paths with spaces work
- [ ] MCP server starts successfully
- [ ] All bash-isms fixed

---

## Phase 7: Documentation Updates (Week 6-7)

### Objectives

- Update README with OpenCode-specific instructions
- Create OPENCODE-BOOTSTRAP.md
- Update AGENTS.md for OpenCode
- Create migration guide for users

### Tasks

#### 7.1 README Updates

- [ ] Update installation instructions for OpenCode
- [ ] Replace Claude Code references with OpenCode
- [ ] Update quick start guide
- [ ] Update command examples
- [ ] Update CLI command references
- [ ] Add OpenCode badges and links

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

### Verification

- [ ] All Claude Code references removed
- [ ] OpenCode installation documented
- [ ] All new docs complete
- [ ] All links work

---

## Phase 8: Testing & Cleanup (Week 7-8)

### Objectives

- End-to-end testing of all features
- MCP server testing
- GitHub Action testing
- Regression testing of all commands
- Remove Claude Code configuration
- Final validation

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

### Verification

- [ ] Complete workflow tested
- [ ] All 17 commands tested
- [ ] Image analysis works
- [ ] Issue response works
- [ ] Original behavior preserved
- [ ] Claude Code configs removed
- [ ] Lint checks pass
- [ ] Rollback procedures documented

---

## Success Criteria

### Migration Complete When:

- ✅ All 17 commands migrated to `.opencode/command/`
- ✅ Permission system designed, implemented, and tested
- ✅ `opencode.jsonc` configuration complete and validated
- ✅ Session hooks plugin working (first-run, updates)
- ✅ MCP server configured and tested
- ✅ GitHub Action converted and tested
- ✅ All shell scripts verified on Windows
- ✅ Documentation updated (README, AGENTS.md, new guides)
- ✅ All tests pass (lint, format, functionality)
- ✅ Claude Code configuration removed
- ✅ Migration guide for users complete
- ✅ Rollback procedures documented

### Migration Successful When:

- ✅ User can run `/thinking-partner` with same experience
- ✅ User can run `/init-bootstrap` for setup
- ✅ MCP vision features work identically
- ✅ Daily workflow (/daily-review) works seamlessly
- ✅ GitHub Action responds to @mentions
- ✅ All permissions enforced correctly
- ✅ Windows users have full functionality
- ✅ Documentation is clear and complete

---

## Rollback Plan

### Partial Rollback Triggers:

- **Phase 1-2**: Configuration issues → Keep Claude Code config, use OpenCode for testing only
- **Phase 3-4**: Command issues → Revert to Claude Code commands, keep OpenCode config
- **Phase 5-6**: Integration issues → Keep both systems running side-by-side

### Full Rollback Procedure:

1. Restore `.claude/` configuration from backup
2. Revert `opencode.jsonc` to `.claude/settings.json`
3. Restore command files to `.claude/commands/`
4. Revert GitHub Action to Claude Code
5. Archive `.opencode/` directory
6. Document issues for future attempt
7. Create tag: `v0.14.0-opencode-failed-rollback`

---

## Timeline Summary

| Week | Phase              | Focus                          |
| ---- | ------------------ | ------------------------------ |
| 0    | Pre-Migration      | Setup, backup, planning        |
| 1    | Core Configuration | opencode.jsonc, plugins, MCP   |
| 1-2  | Permission System  | Agent profiles, rules, testing |
| 2-3  | P0 Commands        | 5 critical commands            |
| 3-4  | P1-P2 Commands     | 12 remaining commands          |
| 4-5  | GitHub Action      | Workflow conversion, testing   |
| 5-6  | Windows Testing    | Scripts, paths, MCP            |
| 6-7  | Documentation      | Updates, new guides            |
| 7-8  | Testing & Cleanup  | E2E testing, final validation  |

**Total Duration**: 8 weeks  
**Critical Path**: Phase 1 → 2 → 3 → 5 → 8

---

**Plan Created:** January 6, 2026  
**Last Updated:** January 6, 2026  
**Status:** Ready to begin Phase 0
