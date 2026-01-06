# OpenCode Permission System

**Last Updated:** January 6, 2026

## Overview

This document describes the permission system for OpenCode agents in the claudesidian vault. Permissions control which tools agents can access and what operations they can perform.

## Permission Levels

- **allow**: Agent can use this tool without asking
- **ask**: Agent must ask user before using this tool (default)
- **deny**: Agent cannot use this tool at all

## Agent Profiles

### 1. bootstrap (Full Access Agent)

**Purpose:** Setup wizard, repository operations, system configuration
**Use Cases:**

- Running `/init-bootstrap` for initial setup
- Running `/release` for versioning and publishing
- Running `/upgrade` for updating the vault
- Running `/pull-request` for git operations
- Running `/install-claudesidian-command` for shell integration

**Permissions:**

```json
{
  "permission": {
    "allow": [
      "Read",
      "Write",
      "Edit",
      "MultiEdit",
      "Bash",
      "Glob",
      "Grep",
      "WebFetch",
      "Task"
    ]
  }
}
```

**Bash Permissions:**

```json
{
  "bash": {
    "allow": [
      "git *",
      "gh *",
      "date *",
      "ls *",
      "mkdir *",
      "cp *",
      "mv *",
      "rm *",
      "cat *",
      "find *",
      "grep *",
      "head *",
      "tail *",
      "sed *",
      "awk *",
      "sort *",
      "uniq *",
      "wc *",
      "tree *",
      "du *",
      "curl *",
      "wget *",
      "node *",
      "npm *",
      "pnpm *",
      "bun *",
      "which *",
      "command -v *",
      "echo *",
      "pwd",
      "cd *",
      "chmod *"
    ]
  }
}
```

**Rationale:** This agent needs full access to:

- Read and write any file
- Execute shell commands for git, npm, file operations
- Make network requests (WebFetch) for upgrades and research
- Use glob/grep for file searches
- Use Task tool for complex operations

---

### 2. thinking-partner (Read-Only Agent)

**Purpose:** Collaborative thinking, exploring complex problems
**Use Cases:**

- Running `/thinking-partner` for brainstorming
- Exploring ideas without modifying files
- Asking questions and tracking insights

**Permissions:**

```json
{
  "permission": {
    "allow": ["Read"],
    "ask": ["Search"]
  }
}
```

**Bash Permissions:**

```json
{
  "bash": {
    "deny": ["*"]
  }
}
```

**Rationale:** This agent should only read existing content:

- Read notes to understand context
- Search the vault for related topics
- No ability to modify files or execute commands
- Prevents accidental changes during exploration

---

### 3. research-assistant (Research Agent)

**Purpose:** Information gathering, web research, data collection
**Use Cases:**

- Running `/research-assistant` for vault research
- Downloading attachments from web
- Using Firecrawl for web scraping

**Permissions:**

```json
{
  "permission": {
    "allow": ["Read", "Write", "Edit", "Glob", "Bash"],
    "ask": ["WebFetch"]
  }
}
```

**Bash Permissions:**

```json
{
  "bash": {
    "allow": [
      "ls *",
      "mkdir *",
      "cp *",
      "mv *",
      "cat *",
      "curl *",
      "wget *",
      "pdftotext *",
      "ls -la *"
    ]
  }
}
```

**Rationale:** This agent needs:

- Read and write files for saving research
- Bash for downloading files
- Glob for file searches
- Ask for web access (user consent for external requests)
- No git or npm access (research only)

---

### 4. assistant (Standard Agent)

**Purpose:** General assistance, standard operations
**Use Cases:**

- Running `/add-frontmatter` to enhance notes
- Running `/de-ai-ify` to improve writing
- General file operations with safety checks

**Permissions:**

```json
{
  "permission": {
    "allow": ["Read", "Write", "Edit", "Glob"]
  }
}
```

**Bash Permissions:**

```json
{
  "bash": {
    "ask": ["*"]
  }
}
```

**Rationale:** This agent:

- Can read and write files
- Can edit existing content
- Can search for files with Glob
- Must ask before running any bash commands
- No git or network access by default
- Balanced approach for daily tasks

---

### 5. read-only (Minimal Agent)

**Purpose:** Safe exploration, content review
**Use Cases:**

- Running `/inbox-processor` to review files
- Running `/daily-review` to check progress
- Running `/weekly-synthesis` to analyze activity

**Permissions:**

```json
{
  "permission": {
    "allow": ["Read", "Glob"]
  }
}
```

**Bash Permissions:**

```json
{
  "bash": {
    "deny": ["*"]
  }
}
```

**Rationale:** This agent:

- Can only read files and search with Glob
- Cannot modify any content
- Cannot execute commands
- Safest profile for content review

---

## Tool Descriptions

### File Operations

- **Read**: Read file contents
- **Write**: Create or overwrite files
- **Edit**: Make targeted edits to files
- **MultiEdit**: Make multiple edits in one operation
- **Glob**: Find files matching patterns
- **Grep**: Search file contents

### Execution

- **Bash**: Execute shell commands
- **Task**: Launch sub-agents for complex tasks

### Network

- **WebFetch**: Fetch web content

---

## Permission Patterns

### Pattern Matching

Bash permissions use glob patterns:

- `git *`: All git commands
- `ls *`: All ls commands
- `*`: All commands (use carefully)
- `npm install`: Only npm install (not other npm commands)

### Precedence

1. **Deny** always wins over Allow/Ask
2. **Allow** wins over Ask for specific patterns
3. **Ask** is the default for unspecified tools

---

## Best Practices

### Security Principles

1. **Principle of Least Privilege**
   - Grant only the minimum permissions needed
   - Start with deny, then allow specific operations

2. **User Consent**
   - Ask before potentially destructive operations
   - Ask before network requests
   - Ask before git operations (unless in bootstrap agent)

3. **Clear Boundaries**
   - Read-only agents should never modify files
   - Research agents shouldn't do deployments
   - Bootstrap agent for system changes only

### Permission Updates

When adding new commands:

1. Identify tool requirements
2. Choose appropriate agent profile
3. Update permissions if needed
4. Test with sample operations
5. Document any changes

---

## Common Command Mappings

| Command                      | Agent              | Key Permissions                             |
| ---------------------------- | ------------------ | ------------------------------------------- |
| thinking-partner             | read-only          | Read, Search (ask)                          |
| research-assistant           | research-assistant | Read, Write, Bash (limited), WebFetch (ask) |
| init-bootstrap               | bootstrap          | All tools allowed                           |
| daily-review                 | read-only          | Read, Glob                                  |
| create-command               | bootstrap          | Read, Write, Edit, Bash (ls, mkdir)         |
| inbox-processor              | read-only          | Read, Glob                                  |
| pull-request                 | bootstrap          | All tools, Git access                       |
| release                      | bootstrap          | All tools, Git access                       |
| weekly-synthesis             | read-only          | Read, Glob                                  |
| upgrade                      | bootstrap          | All tools, Git, WebFetch                    |
| add-frontmatter              | assistant          | Read, Write, Edit, Glob                     |
| download-attachment          | research-assistant | Read, Write, Bash (curl, wget)              |
| de-ai-ify                    | assistant          | Read, Write, Edit                           |
| install-claudesidian-command | bootstrap          | Read, Write, Bash (shell config)            |

---

## Testing Permissions

### Test Scenarios

1. **Bootstrap Agent:**
   - Should execute: `git status`, `npm install`, `ls -la`
   - Should not execute: `rm -rf /`, `curl http://malicious-site` (if denied)

2. **Read-Only Agent:**
   - Should execute: `Read file.md`, `Glob *.md`
   - Should not execute: `Write file.md`, `Bash *`
   - Should ask: `Search`

3. **Research Assistant:**
   - Should execute: `curl https://example.com`, `Write research.md`
   - Should ask: `WebFetch`
   - Should not execute: `git push`

### Phase 2 Testing Matrix (Expected Behavior)

**How to Test:**

```bash
# Test each agent with OpenCode CLI
opencode bootstrap
opencode thinking-partner
opencode research-assistant
opencode assistant
opencode read-only
```

**Expected Test Results:**

| Agent              | Read File | Write File | Git Status | Git Push | Curl URL | WebFetch | Result |
| ------------------ | --------- | ---------- | ---------- | -------- | -------- | -------- | ------ |
| bootstrap          | Allow ✅  | Allow ✅   | Allow ✅   | Allow ✅ | Allow ✅ | Allow ✅ | Pass   |
| thinking-partner   | Allow ✅  | Deny ❌    | Deny ❌    | Deny ❌  | Deny ❌  | Deny ❌  | Pass   |
| research-assistant | Allow ✅  | Allow ✅   | Deny ❌    | Deny ❌  | Allow ✅ | Ask ⚠️   | Pass   |
| assistant          | Allow ✅  | Allow ✅   | Ask ⚠️     | Ask ⚠️   | Ask ⚠️   | Ask ⚠️   | Pass   |
| read-only          | Allow ✅  | Deny ❌    | Deny ❌    | Deny ❌  | Deny ❌  | Deny ❌  | Pass   |

**Bash Pattern Testing:**

| Command       | bootstrap | thinking-partner | research-assistant | assistant | read-only |
| ------------- | --------- | ---------------- | ------------------ | --------- | --------- |
| `git status`  | Allow ✅  | Deny ❌          | Deny ❌            | Ask ⚠️    | Deny ❌   |
| `git add .`   | Allow ✅  | Deny ❌          | Deny ❌            | Ask ⚠️    | Deny ❌   |
| `git commit`  | Allow ✅  | Deny ❌          | Deny ❌            | Ask ⚠️    | Deny ❌   |
| `npm install` | Allow ✅  | Deny ❌          | Deny ❌            | Ask ⚠️    | Deny ❌   |
| `ls -la`      | Allow ✅  | Deny ❌          | Ask ⚠️             | Ask ⚠️    | Deny ❌   |
| `curl url`    | Allow ✅  | Deny ❌          | Allow ✅           | Ask ⚠️    | Deny ❌   |
| `rm -rf /`    | Deny ❌   | Deny ❌          | Deny ❌            | Deny ❌   | Deny ❌   |

**File Permission Testing:**

| File Type | Read     | Write   | Edit    | Read .env | Write .env |
| --------- | -------- | ------- | ------- | --------- | ---------- |
| \*.md     | Allow ✅ | Ask ⚠️  | Ask ⚠️  | N/A       | N/A        |
| \*.json   | Allow ✅ | Ask ⚠️  | Ask ⚠️  | N/A       | N/A        |
| \*.mjs    | Allow ✅ | Ask ⚠️  | Ask ⚠️  | N/A       | N/A        |
| \*.sh     | Allow ✅ | Ask ⚠️  | Ask ⚠️  | N/A       | N/A        |
| .env      | Deny ❌  | Deny ❌ | Deny ❌ | Deny ❌   | Deny ❌    |
| \*.pem    | Ask ⚠️   | Ask ⚠️  | Ask ⚠️  | Deny ❌   | Deny ❌    |

**Testing Instructions:**

1. Start each agent: `opencode <agent-name>`
2. Request operations from each test matrix row
3. Verify:
   - ✅ Allow: Operation proceeds without prompt
   - ⚠️ Ask: User is prompted for consent
   - ❌ Deny: Operation is blocked
4. Document any deviations from expected behavior

**Test Verification Checklist:**

- [ ] Bootstrap agent executes all git commands without prompts
- [ ] Bootstrap agent denies `rm -rf /` pattern
- [ ] Thinking-partner cannot write files
- [ ] Thinking-partner cannot execute bash commands
- [ ] Research-assistant can use curl for downloads
- [ ] Research-assistant asks before WebFetch
- [ ] Assistant asks before bash operations
- [ ] Assistant asks before WebFetch
- [ ] Read-only cannot modify any files
- [ ] Read-only cannot execute any bash commands
- [ ] .env files cannot be read or written
- [ ] \*.pem files prompt for consent
- [ ] Pattern matching works for git commands
- [ ] Pattern matching works for npm commands
- [ ] File pattern matching works for extensions

**Testing Notes:**

- OpenCode CLI must be started from the vault directory
- Test with actual file operations, not theoretical
- Document any permission patterns that don't match expected behavior
- Note any permission prompts that appear unexpectedly
- Record any permissions that should prompt but don't

---

## Troubleshooting

### Common Issues

**Issue:** Agent keeps asking for permission

- **Solution:** Add tool to `allow` list for that agent

**Issue:** Agent can't run command

- **Solution:** Check bash permission pattern matches exactly

**Issue:** Agent modifies files unexpectedly

- **Solution:** Remove Write/Edit from agent permissions

---

## Future Considerations

### Potential Improvements

1. **Granular File Path Permissions**
   - Allow/deny specific directories
   - Example: Allow `00_Inbox/*`, deny `.claude/*`

2. **Time-Based Permissions**
   - Restrict operations during certain hours
   - Example: No git pushes during review period

3. **Audit Logging**
   - Track which permissions are requested
   - Review patterns for security

---

## Changelog

**January 6, 2026:**

- Initial permission system design
- Created 5 agent profiles
- Mapped 14 commands to agents
- Documented tool usage matrix
