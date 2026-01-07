# Claudesidian Obsidian Plugin Installation Guide

This guide will walk you through installing the Claudesidian plugin in your Obsidian vault.

## Prerequisites

Before installing the plugin, ensure you have:

1. **Obsidian installed** - Download from [obsidian.md](https://obsidian.md) if you haven't already
2. **An Obsidian vault** - Create a new vault or use an existing one
3. **OpenCode Server** - The plugin requires OpenCode server to be running
   - Install: `npm install -g @opencode-ai/cli` or `pnpm add -g @opencode-ai/cli`
   - Start server: `opencode server` (default: `http://localhost:4096`)

## Installation Methods

### Method 1: Manual Installation (Recommended for Development)

This method is best if you're developing the plugin or want to use the latest version directly from the repository.

#### Step 1: Locate Your Obsidian Vault

1. Open Obsidian
2. In the left sidebar, right-click on your vault name
3. Select **"Open folder in explorer"** (Windows) or **"Open folder in Finder"** (macOS) or **"Open folder in file manager"** (Linux)

#### Step 2: Access the Plugins Directory

1. Navigate to the `.obsidian` folder in your vault directory
   - **Note**: The `.obsidian` folder is hidden by default on some systems
   - On Windows: Enable "Show hidden files" in File Explorer
   - On macOS: Press `Cmd + Shift + .` to show hidden files
   - On Linux: Press `Ctrl + H` in most file managers

2. Inside `.obsidian`, look for a `plugins` folder
   - If it doesn't exist, create it:
     - Windows: Right-click → New → Folder → Name it `plugins`
     - macOS/Linux: `mkdir plugins` in terminal

#### Step 3: Create Plugin Folder

1. Inside the `plugins` folder, create a new folder named `claudesidian`
   - Windows: Right-click → New → Folder → Name it `claudesidian`
   - macOS/Linux: `mkdir claudesidian` in terminal

#### Step 4: Copy Plugin Files

Copy the following files from the Claudesidian repository into the `claudesidian` folder:

**Required files:**
- `main.js` - The main plugin code (compiled JavaScript)
- `manifest.json` - Plugin metadata and version information
- `styles.css` - Plugin styling (optional but recommended)

**File locations:**
```
Your Vault/
└── .obsidian/
    └── plugins/
        └── claudesidian/
            ├── main.js
            ├── manifest.json
            └── styles.css
```

**Copy commands (if using terminal):**

```bash
# Navigate to your vault's .obsidian/plugins directory
cd "/path/to/your/vault/.obsidian/plugins"

# Create the plugin folder
mkdir claudesidian

# Copy files from the Claudesidian repository
# Replace /path/to/claudesidian with the actual path to the repository
cp /path/to/claudesidian/main.js claudesidian/
cp /path/to/claudesidian/manifest.json claudesidian/
cp /path/to/claudesidian/styles.css claudesidian/
```

#### Step 5: Enable the Plugin

1. Return to Obsidian
2. Click the **Settings** (gear icon) in the bottom-left corner
3. Navigate to **Community plugins** in the left sidebar
4. If this is your first time using community plugins:
   - Click **"Turn on community plugins"** button
   - You may see a warning about safe mode - click **"Turn off safe mode"** to proceed
5. Scroll down to **"Installed plugins"** section
6. Find **"Claudesidian"** in the list
7. Toggle the switch to **ON** to enable the plugin

#### Step 6: Configure the Plugin

1. In the Settings, scroll down to find **"Claudesidian"** in the left sidebar (under "Plugin options")
2. Click on it to open plugin settings
3. Configure the following:
   - **OpenCode Server URL**: Default is `http://localhost:4096`
     - Change if your OpenCode server is running on a different port
     - Format: `http://localhost:PORT` or `http://HOSTNAME:PORT`
   - **Model Settings**: Configure your preferred AI model
   - **Other settings**: Adjust according to your preferences

4. Click outside the settings panel or press `Esc` to close

### Method 2: Using Git (For Developers)

If you're cloning the repository and want to install it as a plugin:

```bash
# Clone the repository
git clone https://github.com/heyitsnoah/claudesidian.git

# Navigate to your Obsidian vault
cd "/path/to/your/vault/.obsidian/plugins"

# Create a symlink (recommended) or copy files
# Symlink allows you to update from the repository easily
ln -s /path/to/claudesidian claudesidian

# OR copy files directly
cp -r /path/to/claudesidian/main.js /path/to/claudesidian/manifest.json /path/to/claudesidian/styles.css claudesidian/
```

**Note**: If using symlink, ensure all three files (`main.js`, `manifest.json`, `styles.css`) are in the root of the repository or adjust the symlink accordingly.

## Verification

After installation, verify the plugin is working:

1. **Check Plugin Status**:
   - Go to Settings → Community plugins
   - Ensure "Claudesidian" shows as **Enabled**

2. **Check for Errors**:
   - Open Obsidian's Developer Console: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)
   - Look for any error messages related to Claudesidian
   - Common issues:
     - "OpenCode server connection failed" → Ensure OpenCode server is running
     - "Plugin failed to load" → Check that all three files are present

3. **Test the Plugin**:
   - Look for the Claudesidian icon in the left sidebar
   - Click it to open the plugin interface
   - Try sending a test query to verify OpenCode connection

## Troubleshooting

### Plugin Not Appearing in Settings

**Problem**: Plugin doesn't show up in "Installed plugins" list

**Solutions**:
- Verify all three files (`main.js`, `manifest.json`, `styles.css`) are in `.obsidian/plugins/claudesidian/`
- Check that `manifest.json` is valid JSON (no syntax errors)
- Restart Obsidian completely
- Check file permissions (ensure files are readable)

### "OpenCode server connection failed" Error

**Problem**: Plugin can't connect to OpenCode server

**Solutions**:
1. **Verify OpenCode server is running**:
   ```bash
   # Check if server is running
   curl http://localhost:4096/health
   # Should return: {"status":"ok"}
   ```

2. **Start OpenCode server**:
   ```bash
   opencode server
   ```

3. **Check server URL in settings**:
   - Go to Settings → Claudesidian
   - Verify "OpenCode Server URL" matches your server address
   - Default: `http://localhost:4096`

4. **Check firewall/network**:
   - Ensure no firewall is blocking port 4096
   - If using a remote server, verify the URL is correct

### Plugin Crashes or Freezes

**Problem**: Plugin causes Obsidian to freeze or crash

**Solutions**:
- Disable the plugin temporarily
- Check the Developer Console for error messages
- Verify you have the latest version of Obsidian
- Check that `main.js` is not corrupted (try re-copying it)
- Report the issue with error logs from the Developer Console

### Styles Not Loading

**Problem**: Plugin works but looks unstyled

**Solutions**:
- Verify `styles.css` is in the plugin folder
- Check file permissions (ensure readable)
- Clear Obsidian cache: Close Obsidian, delete `.obsidian/workspace.json`, restart
- Try reloading the plugin: Settings → Community plugins → Toggle Claudesidian OFF then ON

### "Manifest not found" Error

**Problem**: Obsidian can't find manifest.json

**Solutions**:
- Verify `manifest.json` exists in `.obsidian/plugins/claudesidian/`
- Check file name is exactly `manifest.json` (case-sensitive, no spaces)
- Verify JSON syntax is valid (use a JSON validator)
- Ensure file is not empty

## Updating the Plugin

### Manual Update

1. **Backup current version** (optional but recommended):
   ```bash
   cd "/path/to/your/vault/.obsidian/plugins"
   cp -r claudesidian claudesidian-backup
   ```

2. **Get latest files**:
   - Download or pull latest version from repository
   - Copy new `main.js`, `manifest.json`, and `styles.css` files

3. **Replace files**:
   - Overwrite the old files in `.obsidian/plugins/claudesidian/`

4. **Reload plugin**:
   - In Obsidian: Settings → Community plugins → Toggle Claudesidian OFF then ON
   - Or restart Obsidian

### Using Git (If Using Symlink Method)

```bash
# Navigate to repository
cd /path/to/claudesidian

# Pull latest changes
git pull

# Reload plugin in Obsidian
```

## File Structure Reference

After installation, your vault should have this structure:

```
Your Vault/
├── .obsidian/
│   └── plugins/
│       └── claudesidian/
│           ├── main.js          (Required - Main plugin code)
│           ├── manifest.json     (Required - Plugin metadata)
│           └── styles.css        (Optional - Plugin styles)
├── 00_Inbox/
├── 01_Projects/
└── ... (other vault files)
```

## Uninstallation

To remove the plugin:

1. **Disable the plugin**:
   - Settings → Community plugins → Toggle Claudesidian OFF

2. **Delete plugin files**:
   ```bash
   # Navigate to plugins directory
   cd "/path/to/your/vault/.obsidian/plugins"
   
   # Remove plugin folder
   rm -rf claudesidian
   # OR on Windows: Delete the claudesidian folder manually
   ```

3. **Restart Obsidian** (optional but recommended)

## Additional Resources

- **Obsidian Plugin Development Docs**: [https://docs.obsidian.md/Plugins](https://docs.obsidian.md/Plugins)
- **OpenCode Documentation**: [https://opencode.ai/docs](https://opencode.ai/docs)
- **Claudesidian Repository**: [https://github.com/heyitsnoah/claudesidian](https://github.com/heyitsnoah/claudesidian)
- **Report Issues**: Open an issue on GitHub with error logs from Developer Console

## Support

If you encounter issues not covered in this guide:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review error messages in Obsidian's Developer Console (`Ctrl+Shift+I` or `Cmd+Option+I`)
3. Search existing issues on GitHub
4. Open a new issue with:
   - Obsidian version
   - Plugin version (from manifest.json)
   - Error messages/logs
   - Steps to reproduce the issue

---

**Note**: This plugin requires the OpenCode server to be running. Make sure you have OpenCode installed and the server started before using the plugin.

