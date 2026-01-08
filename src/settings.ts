import { App, PluginSettingTab, Setting, Notice } from 'obsidian'
import type ClaudianPlugin from './main'

export class ClaudianSettingTab extends PluginSettingTab {
  plugin: ClaudianPlugin

  constructor(app: App, plugin: ClaudianPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    containerEl.createEl('h2', { text: 'Claudian Settings' })

    // Server URL setting
    new Setting(containerEl)
      .setName('OpenCode Server URL')
      .setDesc('The URL of the OpenCode server')
      .addText(text => text
        .setPlaceholder('http://localhost:4096')
        .setValue(this.plugin.settings.serverUrl)
        .onChange(async (value) => {
          this.plugin.settings.serverUrl = value
          await this.plugin.saveSettings()
        })
      )

    // Connection timeout setting
    new Setting(containerEl)
      .setName('Connection Timeout')
      .setDesc('Timeout for server connections in milliseconds')
      .addText(text => text
        .setPlaceholder('30000')
        .setValue(this.plugin.settings.timeout.toString())
        .onChange(async (value) => {
          const timeout = parseInt(value)
          if (!isNaN(timeout) && timeout > 0) {
            this.plugin.settings.timeout = timeout
            await this.plugin.saveSettings()
          }
        })
      )

    // Auto-connect setting
    new Setting(containerEl)
      .setName('Auto-connect')
      .setDesc('Automatically connect to OpenCode server on plugin load')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoConnect)
        .onChange(async (value) => {
          this.plugin.settings.autoConnect = value
          await this.plugin.saveSettings()
        })
      )

    // Agent setting
    new Setting(containerEl)
      .setName('Default Agent')
      .setDesc('The default agent to use for conversations')
      .addDropdown(dropdown => dropdown
        .addOption('assistant', 'Assistant')
        .addOption('bootstrap', 'Bootstrap')
        .addOption('thinking-partner', 'Thinking Partner')
        .addOption('research-assistant', 'Research Assistant')
        .addOption('read-only', 'Read Only')
        .setValue(this.plugin.settings.agent)
        .onChange(async (value) => {
          this.plugin.settings.agent = value
          await this.plugin.saveSettings()
        })
      )

    // Model provider setting
    new Setting(containerEl)
      .setName('Model Provider')
      .setDesc('The AI model provider to use')
      .addDropdown(dropdown => dropdown
        .addOption('anthropic', 'Anthropic')
        .addOption('openai', 'OpenAI')
        .addOption('google', 'Google')
        .setValue(this.plugin.settings.model.providerID)
        .onChange(async (value) => {
          this.plugin.settings.model.providerID = value
          await this.plugin.saveSettings()
        })
      )

    // Model ID setting
    new Setting(containerEl)
      .setName('Model ID')
      .setDesc('The specific model to use')
      .addText(text => text
        .setPlaceholder('claude-3-5-sonnet-20241022')
        .setValue(this.plugin.settings.model.modelID)
        .onChange(async (value) => {
          this.plugin.settings.model.modelID = value
          await this.plugin.saveSettings()
        })
      )

    // Connection test section
    containerEl.createEl('h3', { text: 'Connection Test' })

    const testContainer = containerEl.createDiv('claudian-test-container')
    
    new Setting(testContainer)
      .setName('Test Connection')
      .setDesc('Test the connection to the OpenCode server')
      .addButton(button => button
        .setButtonText('Test')
        .setCta()
        .onClick(async () => {
          button.setButtonText('Testing...')
          button.setDisabled(true)
          
          try {
            const isHealthy = await this.plugin.openCodeClient.healthCheck()
            if (isHealthy) {
              new Notice('✅ Connection successful!')
            } else {
              new Notice('❌ Server not reachable')
            }
          } catch (error) {
            new Notice(`❌ Connection failed: ${error.message}`)
          } finally {
            button.setButtonText('Test')
            button.setDisabled(false)
          }
        })
      )

    // Server status section
    containerEl.createEl('h3', { text: 'Server Status' })
    
    const statusContainer = containerEl.createDiv('claudian-status-container')
    this.displayServerStatus(statusContainer)

    // Refresh status button
    new Setting(statusContainer)
      .addButton(button => button
        .setButtonText('Refresh Status')
        .onClick(() => {
          this.displayServerStatus(statusContainer)
        })
      )
  }

  private async displayServerStatus(container: HTMLElement) {
    // Clear previous status
    const existingStatus = container.querySelector('.claudian-server-status')
    if (existingStatus) {
      existingStatus.remove()
    }

    const statusEl = container.createDiv('claudian-server-status')
    
    try {
      const isHealthy = await this.plugin.openCodeClient.healthCheck()
      const isConnected = this.plugin.openCodeClient.isConnected
      
      statusEl.createEl('p', {
        text: `Server Health: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`,
        cls: isHealthy ? 'claudian-status-good' : 'claudian-status-bad'
      })
      
      statusEl.createEl('p', {
        text: `Client Status: ${isConnected ? '✅ Connected' : '❌ Disconnected'}`,
        cls: isConnected ? 'claudian-status-good' : 'claudian-status-bad'
      })

      if (isConnected) {
        const sessionId = this.plugin.openCodeClient.getSessionId()
        statusEl.createEl('p', {
          text: `Session ID: ${sessionId || 'None'}`,
          cls: 'claudian-status-info'
        })
      }
      
    } catch (error) {
      statusEl.createEl('p', {
        text: `❌ Status check failed: ${error.message}`,
        cls: 'claudian-status-bad'
      })
    }
  }
}