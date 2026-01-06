---
agent: bootstrap
description: Interactive setup wizard for personalized CLAUDE.md configuration
argument-hint: (optional) path to existing vault or 'new' for fresh setup
---

# Initialize Bootstrap Configuration

This command helps you create a personalized CLAUDE.md configuration file by
asking questions about your Obsidian workflow and preferences.

## Task

Read the CLAUDE-BOOTSTRAP.md template and interactively gather information about
the user's:

- Existing vault structure (if any)
- Workflow preferences
- Note-taking style
- Organization methods
- Specific requirements

Then generate a customized CLAUDE.md file tailored to their needs.

## Process

1. **Initial Environment Setup**
   - Get current date with `date` command for timestamps
   - Check current folder name and ask if they want to rename it
   - If yes, guide them through renaming (handle parent directory move)
   - Check for package.json and install dependencies:
     - Try `pnpm install` first (faster, better)
     - Fall back to `npm install` if pnpm not available
   - Verify core dependencies are installed
   - Check git status:
     - If no .git folder: Initialize git repository
     - If has remote origin: Ask about development work
       - Personal vault: Remove origin and .github folder
       - Contributing: Keep origin and workflows intact
     - If clean local repo: Ready to go
   - Don't create folders yet - wait until after asking about organization
     method

2. **Check Existing Configuration**
   - Look for existing CLAUDE.md
   - If exists, ask if they want to update or start fresh
   - Check for CLAUDE-BOOTSTRAP.md template

3. **Gather Vault Information**
   - Search common locations for existing Obsidian vaults (.obsidian folder)
   - Check these paths with appropriate depth limits:
     - `~/Documents` (maxdepth 3) - all platforms
     - `~/Desktop` (maxdepth 3) - all platforms
     - `~/Library/Mobile Documents/iCloud~md~obsidian/Documents` (maxdepth 5 -
       **macOS only**, iCloud vaults)
     - Home directory `~/` (maxdepth 2) - all platforms
     - Current directory parent (maxdepth 2) - all platforms
   - If found, ask: "Found Obsidian vault at [path]. Is this the vault you want
     to import?"
   - Count files correctly: `find [path] -type f -name "*.md" | wc -l` (no depth
     limit)
   - Show vault size: `du -sh [path]`
   - If confirmed, analyze vault structure:
     - Run `tree -L 3 -d [path]` to see folder hierarchy
     - Sample 10-15 random notes to understand content types
     - List 30-50 recent file names to detect naming patterns
     - Check for daily notes folder and format
     - Identify most active folders by file count
     - Detect if using PARA, Zettelkasten, Johnny Decimal, or custom
   - If not the right one or none found:
     - **On macOS only:** Ask: "Is your vault stored in iCloud Drive? (yes/no)"
     - If yes (macOS): "Please enter the full path to your vault (e.g.,
       ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/YourVault)"
     - If no, or on Linux/Windows: "Please enter the path to your existing
       vault, or type 'skip' to start fresh"
     - **Validate user-provided paths** (see "User Path Validation" section
       below)
   - If no existing vault or user skips, they're starting fresh

4. **Ask Configuration Questions**
   - "What's your name?" (for personalization)
   - "Would you like me to research your public work to better understand your
     context?"
     - If yes: Search for information
     - ALWAYS show findings and ask "Is this correct?" for confirmation
     - If multiple people found, list them numbered for selection
     - If wrong person, offer to search again or skip
     - Save relevant context about their work, writing style, areas of expertise
   - "Do you follow the PARA method or have a different organization system?"
   - "What are your main use cases? (research, writing, project management,
     knowledge base, daily notes)"

   **If using PARA, ask specific setup questions:**
   [PARA Method by Tiago Forte](https://fortelabs.com/blog/para/)
   - "What active projects are you working on?" (Create folders in 01_Projects)
   - "What areas of responsibility do you maintain?" (e.g., Work, Health,
     Finance, Family)
   - "What topics do you research frequently?" (Set up in 03_Resources)
   - "Any projects you recently completed?" (Can archive with summaries)

   **General preferences:**
   - Check .obsidian/community-plugins.json to see what plugins they use
   - Analyze existing files to detect naming convention automatically
   - Check for attachments folder to see if they work with media files
   - "Do you use git for version control?"
   - "Any specific websites or resources you reference often?"
   - "Do you have any specific writing style preferences?"
   - "Are there any workflows or patterns you want Claude to follow?"
   - "Would you like a weekly review ritual? (e.g., Thursday project review)"
   - "Do you prefer 'thinking mode' (questions/exploration) vs 'writing mode'?"

5. **Optional Tool Setup**

   **Gemini Vision (already included)**
   - Ask: "Gemini Vision is already included for analyzing images, PDFs, and
     videos. Would you like to activate it? (yes/no/later)"
   - Explain: "You just need a free API key from Google. This lets Claude
     analyze any visual content in your vault."
   - If later: "No problem! You can set it up anytime by running
     `/setup-gemini`"
   - If yes:
     - Guide to get API key from https://aistudio.google.com/apikey (free, takes
       30 seconds)
     - Help add to shell profile (.zshrc, .bashrc, etc.)
     - Run
       `opencode mcp add gemini-vision node .claude/mcp-servers/gemini-vision.mjs`
     - Configure with API key
     - Test the connection with a sample command

   **Firecrawl (already included)**
   - Ask: "Firecrawl is included for web research. Would you like to set it up?
     (yes/no/later)"
   - Explain: "This is a game-changer for research! When you find an article or
     website, you can save it directly to your vault as markdown - preserving
     the content forever, making it searchable, and letting Claude analyze it.
     Perfect for building a research library."
   - Example: "Just tell Claude: 'Save this article to my vault: [URL]' and it's
     done!"
   - If later: "You can set it up anytime by running `/setup-firecrawl`"
   - If yes:
     - Guide to get API key from https://firecrawl.dev (free tier available)
     - Help configure the scripts in .scripts/
     - Show example usage: `.scripts/firecrawl-scrape.sh https://example.com`

6. **Generate Custom Configuration**
   - Get current date: `date +"%B %d, %Y"` for the CLAUDE.md header
   - Save preferences to `.claude/vault-config.json`:
     ```json
     {
       "user": {
         "name": "Jane Smith",
         "background": {
           "companies": ["Variance", "Percolate"],
           "roles": ["Co-founder", "Writer"],
           "publications": ["Why Is This Interesting?", "every.to"],
           "expertise": [
             "Developer tools",
             "Marketing tech",
             "Systems thinking"
           ],
           "interests": ["AI for thinking", "Note-taking systems", "Creativity"]
         },
         "profileSources": [
           "https://whyisthisinteresting.com/about",
           "https://every.to/@username"
         ],
         "customContext": "Focuses on AI as thinking augmentation, not just writing",
         "publicProfile": true
       },
       "vaultPath": "/path/to/existing/vault",
       "fileNamingPattern": "detected-pattern",
       "organizationMethod": "PARA",
       "primaryUses": ["research", "writing", "projects"],
       "tools": {
         "geminiVision": true,
         "firecrawl": false
       },
       "projects": ["Book - Productivity", "SaaS App"],
       "areas": ["Newsletter", "Health"],
       "importedAt": "2025-01-13",
       "lastUpdated": "2025-01-13"
     }
     ```
   - Start with CLAUDE-BOOTSTRAP.md as base
   - Add user-specific sections:
     - Custom folder structure with their actual projects/areas
     - Personal workflows
     - Preferred tools and scripts
     - Specific guidelines
     - MCP configuration if set up
   - Include their websites/resources if provided
   - Add any custom naming conventions
   - Pre-populate with their projects and areas:
     - Create project folders in 01_Projects/
     - Create area folders in 02_Areas/
     - Create resource topics in 03_Resources/
     - Add README files explaining each project/area

7. **Import Existing Vault (if applicable)**
   - If user has existing vault:
     - Create OLD_VAULT folder: `mkdir OLD_VAULT`
     - Copy entire vault preserving structure:
       `cp -r [vault-path]/* ./OLD_VAULT/`
     - Copy Obsidian configuration: `cp -r [vault-path]/.obsidian ./`
     - Check for and copy other important files:
       - `.trash/` (Obsidian's trash folder)
       - `.smart-connections/` (if using that plugin)
       - Any workspace files: `.obsidian.vimrc`, etc.
     - Skip copying: `.git/` (they'll have their own), `.claude/` (using ours)
     - Show summary: "Imported your vault to OLD_VAULT/ (X files, Y folders)"
     - Explain: "Your original structure is preserved in OLD_VAULT. You can
       gradually migrate files to the PARA folders as needed."

8. **Create Supporting Files**
   - Generate initial folder structure if new vault
   - Create README files for main folders
   - For each project folder, create subfolders:
     - Research/ (source materials)
     - Chats/ (AI conversations)
     - Daily Progress/ (running log)
   - Create 05_Attachments/Organized/ directory
   - Set up .gitignore if using git (include .mcp.json, node_modules)
   - Create initial templates if requested
   - Create WEEKLY_REVIEW.md if user wants review ritual
   - Remove FIRST_RUN marker file if it exists
   - Make initial git commit if repository was initialized

9. **Run Test Commands**
   - Execute `pnpm vault:stats` to verify scripts work
   - Test attachment commands if folders exist
   - Test MCP tools if configured
   - Verify git is tracking files correctly

10. **Provide Next Steps**

- Summary of what was created and configured
- Quick start guide specific to their setup
- List of available commands they can use
- Test commands to verify everything works
- Suggestions for first tasks based on their use cases
- How to modify configuration later

## Example Output

```markdown
# Your Obsidian Vault Configuration

Generated on: [Run `date +"%B %d, %Y"` to get current date] Last updated: [Same
date] Based on your preferences for: [main use cases] Setup completed with: ✅
Dependencies ✅ Folder structure ✅ Git initialized

## Your Custom Folder Structure

[Their specific structure with explanations]

## Your Workflows

### Daily Routine

[Based on their answers]

### Project Management

[Their specific approach]

### Research Method (Noah Brier Style)

- Capture everything you read
- Let important ideas naturally resurface
- Start with writing to test understanding
- Use search, not tags, to find things
- [Learn more from Noah's system](https://every.to/superorganizers/ceo-by-day-internet-sleuth-by-night-267452)

### Weekly Review Ritual

[If enabled: Every Thursday at 4pm, review all projects]

## Your Preferences

### File Naming

- Pattern: [their convention]
- Examples: [specific examples]

### Tools & Scripts

[Relevant scripts for their workflow]

## MCP Servers (if configured)

### Gemini Vision

- Status: ✅ Configured and tested
- API Key: Set in .mcp.json
- Test with: `Use gemini-vision to analyze [image path]`

## Available Commands

### Vault Management

- `pnpm vault:stats` - Show vault statistics
- `pnpm attachments:list` - List unprocessed attachments
- `pnpm attachments:organized` - Count organized files

### OpenCode Commands

- `/thinking-partner` - Collaborative thinking mode
- `/daily-review` - Review your day
- `/init-bootstrap` - Re-run this setup

## Quick Start

1. [Personalized first step]
2. [Next action based on their goals]
3. [Specific to their workflow]

## Pro Tips from Research Masters

- **Be a token maximalist**: Provide lots of context to Claude
- **Writing scales**: Document everything for future reference
  ([Noah Brier](https://every.to/superorganizers/ceo-by-day-internet-sleuth-by-night-267452))
- **Trust emergence**: Important ideas will keep surfacing
- **Start with writing**: Always begin projects in text form
- **Review regularly**: Set aside time weekly to prune and update
- **PARA Method**: Projects, Areas, Resources, Archive
  ([Tiago Forte](https://fortelabs.com/blog/para/))

## Setup Summary

✅ Dependencies installed (pnpm/npm) ✅ Folder structure created ✅ Git
repository initialized and disconnected from original ✅ CLAUDE.md personalized
✅ First-run setup completed [✅ MCP Gemini Vision configured - if set up] [✅
First commit made - if git was initialized]
```

## Important Implementation Notes

### Platform Compatibility

This command is designed to work across Linux, macOS, and Windows (WSL/Git
Bash), with platform-specific features:

**All Platforms:**

- Search ~/Documents, ~/Desktop, home directory
- Standard Obsidian vault detection
- Full vault import and setup

**macOS Only:**

- iCloud Drive vault detection and import
- Obsidian's iCloud sync is macOS-only, so iCloud features are disabled on other
  platforms
