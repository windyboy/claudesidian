import { Plugin, WorkspaceLeaf, Notice } from 'obsidian'
import { OpenCodeClient, type ResponseChunk } from './opencode-client'
import { ClaudianView, VIEW_TYPE_CLAUDIAN } from './claudian-view'
import { ClaudianSettingTab } from './settings'
import type { ClaudianSettings } from './types'

// Import CSS as text
import cssText from './styles.css'

const DEFAULT_SETTINGS: ClaudianSettings = {
  serverUrl: 'http://localhost:4096',
  timeout: 30000,
  agent: 'assistant',
  model: {
    providerID: 'anthropic',
    modelID: 'claude-3-5-sonnet-20241022'
  },
  autoConnect: true
}

export default class ClaudianPlugin extends Plugin {
  settings: ClaudianSettings
  openCodeClient: OpenCodeClient
  private eventStream: EventSource | null = null

  async onload() {
    await this.loadSettings()
    
    // Inject CSS
    const styleEl = document.createElement('style')
    styleEl.textContent = cssText
    document.head.appendChild(styleEl)
    
    // Initialize OpenCode client
    this.openCodeClient = new OpenCodeClient({
      serverUrl: this.settings.serverUrl,
      timeout: this.settings.timeout
    })

    // Register the main view
    this.registerView(
      VIEW_TYPE_CLAUDIAN,
      (leaf) => new ClaudianView(leaf, this)
    )

    // Add ribbon icon
    this.addRibbonIcon('bot', 'Open Claudian', () => {
      this.activateView()
    })

    // Add command to open view
    this.addCommand({
      id: 'open-view',
      name: 'Open chat view',
      callback: () => {
        this.activateView()
      }
    })

    // Add settings tab
    this.addSettingTab(new ClaudianSettingTab(this.app, this))

    // Auto-connect if enabled
    if (this.settings.autoConnect) {
      this.connectToOpenCode()
    }

    // Set up event stream for real-time updates
    this.setupEventStream()
  }

  onunload() {
    this.disconnectEventStream()
    this.openCodeClient.disconnect()
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }

  async activateView() {
    const { workspace } = this.app

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN)[0]

    if (!leaf) {
      // Create new leaf in right sidebar
      const rightLeaf = workspace.getRightLeaf(false)
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: VIEW_TYPE_CLAUDIAN,
          active: true
        })
        leaf = rightLeaf
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf)
    }
  }

  async connectToOpenCode(): Promise<boolean> {
    try {
      await this.openCodeClient.connect()
      new Notice('Connected to OpenCode server')
      return true
    } catch (error) {
      console.error('Failed to connect to OpenCode:', error)
      new Notice(`Failed to connect to OpenCode: ${error.message}`)
      return false
    }
  }

  private setupEventStream() {
    if (!this.settings.serverUrl) return

    try {
      // Close existing connection
      this.disconnectEventStream()

      this.eventStream = new EventSource(`${this.settings.serverUrl}/events`)
      
      this.eventStream.onopen = () => {
        console.log('Event stream connected')
        this.updateConnectionStatus(true)
      }

      this.eventStream.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleServerEvent(data)
        } catch (error) {
          console.error('Failed to parse event data:', error)
        }
      }

      this.eventStream.onerror = (error) => {
        console.error('Event stream error:', error)
        this.updateConnectionStatus(false)
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
          if (this.eventStream?.readyState === EventSource.CLOSED) {
            console.log('Attempting to reconnect event stream...')
            this.setupEventStream()
          }
        }, 5000)
      }
    } catch (error) {
      console.error('Failed to setup event stream:', error)
    }
  }

  private disconnectEventStream() {
    if (this.eventStream) {
      this.eventStream.close()
      this.eventStream = null
    }
  }

  private updateConnectionStatus(connected: boolean) {
    const view = this.getActiveView()
    if (view) {
      view.updateConnectionStatus(connected)
    }
  }

  private handleServerEvent(event: any) {
    console.log('Server event received:', event)
    
    // Handle different event types
    switch (event.type) {
      case 'session.created':
        this.handleSessionCreated(event)
        break
      
      case 'tool.execute.before':
        this.handleToolExecuteBefore(event)
        break
      
      case 'tool.execute.after':
        this.handleToolExecuteAfter(event)
        break
      
      case 'permission.request':
        this.handlePermissionRequest(event)
        break
      
      case 'message.updated':
        this.handleMessageUpdated(event)
        break
      
      case 'session.compacting':
        this.handleSessionCompacting(event)
        break
      
      default:
        console.log('Unhandled server event:', event.type)
    }

    // Forward all events to the active view
    const view = this.getActiveView()
    if (view) {
      view.handleServerEvent(event)
    }
  }

  private handleSessionCreated(event: any) {
    console.log('Session created:', event.sessionId)
    // Update the current session ID
    if (event.sessionId) {
      this.openCodeClient.setSessionId(event.sessionId)
    }
  }

  private handleToolExecuteBefore(event: any) {
    console.log('Tool execution starting:', event.tool)
    new Notice(`Executing tool: ${event.tool}`)
  }

  private handleToolExecuteAfter(event: any) {
    console.log('Tool execution completed:', event.tool)
    if (event.error) {
      new Notice(`Tool error: ${event.error}`, 5000)
    }
  }

  private async handlePermissionRequest(event: any) {
    console.log('Permission request:', event)
    
    const view = this.getActiveView()
    if (!view) {
      console.error('No active view to handle permission request')
      return
    }

    // Show permission request modal
    await view.showPermissionRequest(event.request, event.requestId)
  }

  private handleMessageUpdated(event: any) {
    console.log('Message updated:', event.messageId)
    // The view will handle the actual message update
  }

  private handleSessionCompacting(event: any) {
    console.log('Session compacting:', event.sessionId)
    new Notice('Session context is being optimized...', 3000)
  }

  getActiveView(): ClaudianView | null {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDIAN)
    if (leaves.length > 0) {
      return leaves[0].view as ClaudianView
    }
    return null
  }

  async sendPrompt(
    prompt: string,
    options: {
      sessionId?: string
      model?: { providerID: string; modelID: string }
      agent?: string
      system?: string
      tools?: { [key: string]: boolean }
      cwd?: string
      abortController?: AbortController
    } = {}
  ): Promise<AsyncGenerator<ResponseChunk>> {
    // Ensure connection
    if (!this.openCodeClient.isConnected) {
      const connected = await this.connectToOpenCode()
      if (!connected) {
        throw new Error('Failed to connect to OpenCode server')
      }
    }

    // Use settings defaults if not provided
    const finalOptions = {
      model: this.settings.model,
      agent: this.settings.agent,
      cwd: this.app.vault.adapter.basePath,
      ...options
    }

    return this.openCodeClient.sendPrompt(prompt, finalOptions)
  }
}