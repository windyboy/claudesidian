---
agent: bootstrap
description: Intelligently upgrade with new features while preserving customizations
argument-hint: (optional) 'check' to preview changes, 'force' to skip confirmations
---

# Smart Upgrade Command

Intelligently upgrades your claudesidian installation by fetching the latest
release from GitHub and using AI-powered semantic analysis to merge new features
with your existing customizations. Preserves user intent while adding new
capabilities.

## Task

1. Check GitHub for the latest claudesidian release
2. Download and analyze what has changed since your version
3. Use Claude's semantic understanding to identify user customizations
4. Intelligently merge new features with existing customizations
5. Safely apply updates while preserving user data and preferences
6. Create backups and provide rollback options

## Process

### 1. **Version Check & Setup**

- Get current version from package.json
- Check if already on latest version:

  ```bash
    CURRENT=$(grep '"version"' package.json | sed 's/.*: "\(.*\)".*/\1/')
    LATEST=$(curl -s https://raw.githubusercontent.com/heyitsnoah/claudesidian/main/package.json | grep '"version"' | sed 's/.*: "\(.*\)".*/\1/')

    if [ "$CURRENT" = "$LATEST" ]; then
      echo "✅ You're already on the latest version ($CURRENT)"
      exit 0
    fi
  ```

- Create timestamped backup in `.backup/upgrade-YYYY-MM-DD-HHMMSS/`:

  ```bash
    # Create backup directory
    BACKUP_DIR=".backup/upgrade-$(date +%Y-%m-%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    # Copy all important files to backup
    cp -r .claude "$BACKUP_DIR/"
    cp -r .scripts "$BACKUP_DIR/"
    cp package.json "$BACKUP_DIR/"
    cp CHANGELOG.md "$BACKUP_DIR/" 2>/dev/null || true
    cp README.md "$BACKUP_DIR/" 2>/dev/null || true

    echo "✅ Backup created in $BACKUP_DIR"
  ```

- Clone latest claudesidian to temp directory (doesn't affect user's repo):
  ```bash
    # Get fresh copy in .tmp dir (hidden from Obsidian) - user's repo stays disconnected
    git clone --depth=1 --branch=main https://github.com/heyitsnoah/claudesidian.git .tmp/claudesidian-upgrade
  ```
- Now we have the latest version to compare against

### 2. **Create Upgrade Checklist**

- Compare system files between current directory and .tmp/claudesidian-upgrade/:

  ```bash
    # Find all system files that differ AND new files in upstream
    # First, find files that exist in both but differ
    diff -qr . .tmp/claudesidian-upgrade/ --include="*.md" --include="*.sh" --include="*.json" |
    grep -E '(\.claude/|\.scripts/|package\.json|CHANGELOG\.md|README\.md)' |
    grep -v '(00_|01_|02_|03_|04_|05_|06_|\.obsidian|CLAUDE\.md)'

    # Also find NEW files in upstream (like new commands)
    find .tmp/claudesidian-upgrade/.claude/commands -name "*.md" | while read f; do
      local_file=${f#.tmp/claudesidian-upgrade/}
      [ ! -f "$local_file" ] && echo "NEW: $local_file"
    done
  ```

- Create checklist of files that need review
- Explicitly EXCLUDE:
  - User content folders (00_Inbox, 01_Projects, etc.)
  - User's CLAUDE.md (their personalized version)
  - vault-config.json (user's vault configuration)
  - .obsidian/ (user's Obsidian settings)
  - Any .md files in root except README and CHANGELOG
- Create `.upgrade-checklist.md` with only system files that differ
- Mark each file with status: `[ ] pending`, `[x] updated`, `[-] skipped`
- Group files by type for easier review:

  ```markdown
  ## Commands (12 files)

  [ ] .claude/commands/init-bootstrap.md
  [ ] .claude/commands/release.md
  [ ] .claude/commands/thinking-partner.md ...

  ## Settings (2 files)

  [ ] .claude/settings.json
  [ ] .claude/settings.local.json

  ## Core Files (3 files)

  [ ] package.json
  [ ] CHANGELOG.md
  [ ] README.md
  ```

### 3. **File-by-File Review**

**⚠️ CRITICAL IMPLEMENTATION REQUIREMENT:**

- **NEVER blindly overwrite files without showing diffs first**
- **ALWAYS show diffs to the user first**
- **ALWAYS ask for confirmation before replacing files**
- **Skipping these steps can lose user customizations!**
- **NEVER use `cp` or `cp -f` (both can cause prompts on protected files)**
- **ALWAYS USE `cat source > dest` for guaranteed non-interactive replacement**
- **WAIT for actual user input - don't automatically choose option 1**

For EACH file in checklist:

1.  Read current checklist status from `.upgrade-checklist.md`
2.  **MANDATORY: Show the diff between local and upstream**:
    ```bash
    # ALWAYS show this to the user!
    diff -u current/file .tmp/claudesidian-upgrade/file
    ```
3.  Determine update strategy:
    - **No local changes**: Direct replace from upstream
    - **Never update**: User's CLAUDE.md, vault-config.json, .mcp.json
    - **Local changes detected**: Ask user:

      ```
        File: .claude/commands/thinking-partner.md has local modifications

        Options:
        1. Keep your version (skip update)
        2. Take upstream version (lose your changes)
        3. View diff and decide
        4. Try to merge both (AI-assisted)

        Choice (1/2/3/4): [WAIT FOR USER TO TYPE NUMBER AND PRESS ENTER]
      ```

      **IMPORTANT**: Actually WAIT for the user to type their choice! Do NOT
      automatically select any option. The user must manually type 1, 2, 3, or 4
      and press Enter.

4.  Apply the chosen strategy:
    - **For option 1 (Apply update/Take upstream)**:
      ```bash
      # IMPORTANT: Check if file exists first, then use cat with redirection
      if [ -f ".tmp/claudesidian-upgrade/path/to/file" ]; then
        cat .tmp/claudesidian-upgrade/path/to/file > path/to/file && echo "✅ Updated"
      else
        echo "⚠️ File not found in upstream - keeping local version"
      fi
      ```
    - **For option 2 (Keep your version)**:
      ```bash
      echo "✅ Kept your version"
      ```
    - **For option 4 (AI merge)**: Read both files and create merged version
5.  **CRITICAL: Update the checklist file immediately**:
    ```markdown
    [ ] .claude/commands/init-bootstrap.md → becomes → [x]
    .claude/commands/init-bootstrap.md
    ```
6.  Save `.upgrade-checklist.md` after EVERY file update
7.  Move to next file

### 4. **Update Types**

- **Safe to replace**: `.claude/commands/*.md`, `.claude/agents/*.md`,
  `.scripts/*`
- **Needs review**: `package.json` (preserve user's custom scripts)
- **Never touch**: User content folders, CLAUDE.md, API configs

#### Batch Updates for Similar Files

For commands that have only formatting changes, you can batch update:

```bash
# Batch update multiple command files with same type of changes
for file in thinking-partner.md daily-review.md inbox-processor.md; do
  if [ -f ".tmp/claudesidian-upgrade/.claude/commands/$file" ]; then
    cat ".tmp/claudesidian-upgrade/.claude/commands/$file" > ".claude/commands/$file"
    echo "✅ Updated $file"
  fi
done
```

#### Handling Missing Upstream Files

Some files may exist locally but not in upstream (like deprecated agents):

```bash
# Check if file exists in upstream before trying to update
if [ ! -f ".tmp/claudesidian-upgrade/$filepath" ]; then
  echo "⚠️ $filepath not in upstream - keeping local version"
  # Mark as skipped in checklist: [-]
fi
```

### 5. **Progress Tracking**

- Use TodoWrite tool to track progress alongside checklist
- Save progress after each file in `.upgrade-checklist.md`
- **MUST mark items in checklist**:
  - `[x]` = completed
  - `[-]` = skipped (user customization)
  - `[ ]` = still pending
- If interrupted, can resume from where you left off
- Show progress: "Updating file 5 of 23..."
- Clear indication of what's been done and what's remaining

### 6. **Verification Check**

- Re-check all system files against the checklist
- Compare with checklist to identify:
  - Files marked `[ ]` pending = likely missed (problem)
  - Files marked `[-]` skipped = intentionally kept different (fine)
  - Files marked `[x]` updated but still in diff = merge issues or user edits
    (review)
- Show verification results:
  ```markdown
  ✅ All required files updated successfully
  ℹ️ 2 files intentionally kept with user customizations:

  - .claude/commands/thinking-partner.md (user's concise style)
  - package.json (user's custom scripts preserved)
    or -
    ⚠️ Warning: 2 files appear to be missed (still marked pending):
  - .claude/commands/release.md
  - .scripts/vault-stats.sh
  ```
- Only flag as problem if files are still marked `[ ]` pending in checklist

### 7. **Final Steps**

- Update version in package.json
- Verify all commands work
- Clean up temp directory: `rm -rf .tmp/claudesidian-upgrade`
- Save final checklist for reference (shows what was updated vs skipped)
- Show summary of what was updated

## Update Categories

### 🤖 AI-Powered Intelligent Merge

**Commands** (`.claude/commands/*.md`):

- Analyze user's prompt style, output preferences, workflow modifications
- Merge new features with existing customizations
- Preserve user's tone, structure, and specific requirements

**Agents** (`.claude/agents/*.md`):

- Understand user's interaction preferences
- Combine new capabilities with existing personality
- Maintain user's established workflows

**Templates** (`06_Metadata/Templates/*.md`):

- Preserve custom fields and structure
- Add new template features
- Maintain user's formatting preferences

### ⚡ Automatic Safe Updates

- **New commands/agents**: Purely additive, no conflicts
- **Scripts** (`.scripts/*`): Utility functions, safe to replace
- **Dependencies** (`package.json`): Security and feature updates
- **Documentation**: README, CONTRIBUTING updates

### 🛡️ Never Modified

- **User content**: All `00_*` through `06_*` folders (except templates)
- **Personal config**: User's `CLAUDE.md`
- **API keys**: `.mcp.json`, environment variables
- **Git history**: User's commits and branches

## Command Usage

### Preview Mode (Recommended First Run)

```
/upgrade check
```

- Shows what would be updated
- Displays intelligent merge previews
- No changes made to files
- Safe to run anytime

### Interactive Upgrade

```
/upgrade
```

- Step-by-step confirmation for each change
- Shows before/after for modified files
- Allows selective application of updates
- Creates automatic backups

### Batch Upgrade (Advanced)

```
/upgrade force
```

- Applies all safe updates automatically
- Still prompts for complex merges
- Faster for users comfortable with process
- Full backup created before starting

## Safety Features

### Automatic Backups

- Complete backup before any changes: `.backup/upgrade-[timestamp]/`
- Individual file backups for each modification
- Backup includes current git state and uncommitted changes

### Rollback Support

```
# If upgrade causes issues:
/rollback-upgrade [timestamp]
# Restores from specific backup
```

### Verification Steps

- Post-upgrade functionality testing
- Command validation (runs test commands)
- MCP server connectivity check
- Git repository integrity verification

### Incremental Application

- Updates applied one file at a time
- Validation after each critical change
- Stops on first error with clear diagnostics
- Easy to identify which change caused issues
