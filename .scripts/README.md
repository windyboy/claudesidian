# Scripts Directory

Helper scripts for vault automation and web content capture.

## Available Scripts

### Attachment Management

These are primarily called via npm/pnpm commands in package.json:

- `update-attachment-links.js` - Updates note links after moving attachments
- `fix-renamed-links.js` - Fixes links after renaming files

### Web Content Capture

**Note**: These scripts require API keys to function:

#### firecrawl-scrape.sh

Scrapes a single URL and saves as markdown.

```bash
# Requires FIRECRAWL_API_KEY environment variable
.scripts/firecrawl-scrape.sh <url> <output_file>
```

#### firecrawl-batch.sh

Scrapes multiple URLs and auto-generates filenames.

```bash
# Requires FIRECRAWL_API_KEY environment variable

# Basic usage - saves to 00_Inbox/Clippings/
.scripts/firecrawl-batch.sh <url1> <url2> <url3>

# Custom output directory
.scripts/firecrawl-batch.sh -o 01_Projects/Research/ <url1> <url2>
.scripts/firecrawl-batch.sh --output-dir 03_Resources/Articles/ <url1> <url2>
```

### Transcript Extraction

#### transcript-extract.sh

Extracts transcripts from YouTube videos.

```bash
# Basic usage - saves to 00_Inbox/Clippings/
.scripts/transcript-extract.sh <youtube-url>

# Custom output directory
.scripts/transcript-extract.sh <youtube-url> 01_Projects/Research/
```

## NPM Scripts

Run these from the vault root with `pnpm`:

| Command                        | Description                           |
| ------------------------------ | ------------------------------------- |
| `attachments:list`             | Show first 20 unprocessed attachments |
| `attachments:count`            | Count unprocessed attachments         |
| `attachments:organized`        | Count files in Organized folder       |
| `attachments:unprocessed`      | Same as count                         |
| `attachments:refs <file>`      | Find references to a specific file    |
| `attachments:sizes`            | Show 20 largest attachment files      |
| `attachments:orphans`          | Find unreferenced attachments         |
| `attachments:recent`           | Show files added in last 7 days       |
| `attachments:create-organized` | Create the Organized subfolder        |

## Setup Requirements

### For Web Scraping

1. Get a Firecrawl API key from [firecrawl.dev](https://firecrawl.dev)
2. Add to your shell profile:
   ```bash
   export FIRECRAWL_API_KEY="your-key-here"
   ```

### For Transcript Extraction

- Requires `yt-dlp` and `jq` installed:

  ```bash
  # macOS
  brew install yt-dlp jq

  # Linux
  apt-get install yt-dlp jq
  ```

## Adding Custom Scripts

1. Create script in `.scripts/`
2. Make it executable: `chmod +x .scripts/your-script.sh`
3. Add npm script to `package.json` if needed
4. Document here

## Windows Compatibility

### Requirements

- **Git Bash** (recommended) or **WSL** (Windows Subsystem for Linux)
- Scripts use forward slashes in paths (compatible with Git Bash)
- Node.js installed and accessible in Git Bash

### Setup on Windows

1. **Install Git Bash** (comes with Git for Windows)
2. **Verify Node.js works in Git Bash**:
   ```bash
   node --version
   pnpm --version
   ```

3. **Set environment variables in Git Bash**:
   ```bash
   # Add to ~/.bashrc or ~/.bash_profile
   export FIRECRAWL_API_KEY="your-key-here"
   export GEMINI_API_KEY="your-key-here"
   ```

4. **Run scripts from Git Bash**:
   ```bash
   # Use forward slashes (works in Git Bash)
   .scripts/vault-stats.sh
   .scripts/firecrawl-scrape.sh "https://example.com" "output.md"
   ```

### Known Limitations

- Scripts require Unix-like shell (Git Bash or WSL)
- PowerShell is not supported (use Git Bash instead)
- Paths with spaces work correctly in Git Bash
- Long paths (>260 chars) may require Git config: `git config --global core.longpaths true`

### Testing Scripts on Windows

All scripts have been tested and work correctly with:
- Git Bash on Windows 10/11
- Forward slash paths
- Environment variables from shell profile
- Node.js and pnpm commands

## Notes

- Scripts assume Unix-like environment (macOS/Linux/Windows with Git Bash)
- Windows users must use Git Bash or WSL
- All paths are relative to vault root
- Check script comments for additional requirements
