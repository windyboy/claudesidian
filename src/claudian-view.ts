import { ItemView, WorkspaceLeaf, Notice, Modal, Setting } from 'obsidian'
import type ClaudianPlugin from './main'
import type { Conversation, Message, ServerEvent, ToolUse, ToolResult } from './types'
import type { ResponseChunk } from './opencode-client'

export const VIEW_TYPE_CLAUDIAN = 'claudian-view'

export class ClaudianView extends ItemView {
  plugin: ClaudianPlugin
  private conversations: Conversation[] = []
  private activeConversationId: string | null = null
  private isStreaming = false
  private currentAbortController: AbortController | null = null

  constructor(leaf: WorkspaceLeaf, plugin: ClaudianPlugin) {
    super(leaf)
    this.plugin = plugin
  }

  getViewType() {
    return VIEW_TYPE_CLAUDIAN
  }

  getDisplayText() {
    return 'Claudian'
  }

  getIcon() {
    return 'bot'
  }

  async onOpen() {
    const container = this.containerEl.children[1]
    container.empty()
    container.addClass('claudian-view')

    this.renderView()
    await this.loadConversations()
  }

  async onClose() {
    // Clean up any ongoing streams
    if (this.currentAbortController) {
      this.currentAbortController.abort()
    }
  }

  private renderView() {
    const container = this.containerEl.children[1]
    container.empty()

    // Header with connection status and controls
    const header = container.createDiv('claudian-header')
    this.renderHeader(header)

    // Conversation list/selector
    const conversationSelector = container.createDiv('claudian-conversation-selector')
    this.renderConversationSelector(conversationSelector)

    // Messages container
    const messagesContainer = container.createDiv('claudian-messages')
    this.renderMessages(messagesContainer)

    // Input area
    const inputArea = container.createDiv('claudian-input')
    this.renderInputArea(inputArea)
  }

  private renderHeader(container: HTMLElement) {
    container.empty()

    const statusEl = container.createDiv('claudian-status')
    const isConnected = this.plugin.openCodeClient.isConnected
    statusEl.addClass(isConnected ? 'connected' : 'disconnected')
    statusEl.textContent = isConnected ? '● Connected' : '● Disconnected'

    const controls = container.createDiv('claudian-controls')
    
    // Connect/Disconnect button
    const connectBtn = controls.createEl('button', {
      text: isConnected ? 'Disconnect' : 'Connect',
      cls: 'mod-cta'
    })
    connectBtn.onclick = async () => {
      if (isConnected) {
        this.plugin.openCodeClient.disconnect()
        new Notice('Disconnected from OpenCode')
      } else {
        await this.plugin.connectToOpenCode()
      }
      this.renderHeader(container)
    }

    // New conversation button
    const newConvBtn = controls.createEl('button', {
      text: 'New Chat',
      cls: 'mod-cta'
    })
    newConvBtn.onclick = () => {
      this.createNewConversation()
    }
  }

  private renderConversationSelector(container: HTMLElement) {
    container.empty()

    if (this.conversations.length === 0) {
      container.createDiv('claudian-no-conversations').textContent = 'No conversations yet'
      return
    }

    const select = container.createEl('select', { cls: 'claudian-conversation-select' })
    
    this.conversations.forEach(conv => {
      const option = select.createEl('option', {
        value: conv.id,
        text: conv.title
      })
      if (conv.id === this.activeConversationId) {
        option.selected = true
      }
    })

    select.onchange = () => {
      this.switchConversation(select.value)
    }
  }

  private renderMessages(container: HTMLElement) {
    container.empty()

    const activeConv = this.getActiveConversation()
    if (!activeConv || activeConv.messages.length === 0) {
      container.createDiv('claudian-empty-messages').textContent = 'Start a conversation...'
      return
    }

    activeConv.messages.forEach(message => {
      this.renderMessage(container, message)
    })

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight
  }

  private renderMessage(container: HTMLElement, message: Message) {
    const messageEl = container.createDiv(`claudian-message claudian-message-${message.role}`)
    
    const header = messageEl.createDiv('claudian-message-header')
    header.createSpan('claudian-message-role').textContent = message.role
    header.createSpan('claudian-message-time').textContent = new Date(message.timestamp).toLocaleTimeString()

    const content = messageEl.createDiv('claudian-message-content')
    
    // Handle different content types
    if (typeof message.content === 'string') {
      // Parse and render markdown-like content
      this.renderMessageContent(content, message.content)
    } else {
      // Rich content (could include tool uses, etc.)
      content.createDiv().textContent = JSON.stringify(message.content, null, 2)
    }

    // Render images if present
    if (message.images && message.images.length > 0) {
      const imagesContainer = content.createDiv('claudian-message-images')
      message.images.forEach(img => {
        const imgEl = imagesContainer.createEl('img', {
          attr: { src: img.data, alt: img.name || 'Image' }
        })
        imgEl.style.maxWidth = '300px'
        imgEl.style.maxHeight = '300px'
      })
    }

    // Add message actions (copy, edit, etc.)
    this.addMessageActions(messageEl, message)
  }

  private renderMessageContent(container: HTMLElement, content: string) {
    // Simple markdown-like rendering
    const lines = content.split('\n')
    let currentParagraph = ''
    
    for (const line of lines) {
      if (line.trim() === '') {
        if (currentParagraph) {
          this.createParagraph(container, currentParagraph)
          currentParagraph = ''
        }
      } else if (line.startsWith('```')) {
        if (currentParagraph) {
          this.createParagraph(container, currentParagraph)
          currentParagraph = ''
        }
        // Handle code blocks
        const codeBlock = container.createEl('pre')
        codeBlock.addClass('claudian-code-block')
        const code = codeBlock.createEl('code')
        
        // Extract language if specified
        const language = line.slice(3).trim()
        if (language) {
          code.addClass(`language-${language}`)
        }
        
        // Find the closing ```
        let codeContent = ''
        let i = lines.indexOf(line) + 1
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeContent += lines[i] + '\n'
          i++
        }
        code.textContent = codeContent.trim()
        
        // Add copy button
        this.addCodeBlockActions(codeBlock, codeContent.trim())
      } else {
        currentParagraph += (currentParagraph ? '\n' : '') + line
      }
    }
    
    if (currentParagraph) {
      this.createParagraph(container, currentParagraph)
    }
  }

  private createParagraph(container: HTMLElement, text: string) {
    const p = container.createEl('p')
    
    // Simple inline formatting
    let formattedText = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
    
    p.innerHTML = formattedText
  }

  private addCodeBlockActions(codeBlock: HTMLElement, code: string) {
    const actions = codeBlock.createDiv('claudian-code-actions')
    
    const copyBtn = actions.createEl('button', {
      text: 'Copy',
      cls: 'claudian-code-copy'
    })
    
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(code)
        copyBtn.textContent = 'Copied!'
        setTimeout(() => {
          copyBtn.textContent = 'Copy'
        }, 2000)
      } catch (error) {
        console.error('Failed to copy code:', error)
        new Notice('Failed to copy code')
      }
    }
  }

  private addMessageActions(messageEl: HTMLElement, message: Message) {
    const actions = messageEl.createDiv('claudian-message-actions')
    
    // Copy message button
    const copyBtn = actions.createEl('button', {
      text: '📋',
      cls: 'claudian-message-action',
      attr: { title: 'Copy message' }
    })
    
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(message.content)
        new Notice('Message copied to clipboard')
      } catch (error) {
        console.error('Failed to copy message:', error)
        new Notice('Failed to copy message')
      }
    }

    // Regenerate button for assistant messages
    if (message.role === 'assistant') {
      const regenBtn = actions.createEl('button', {
        text: '🔄',
        cls: 'claudian-message-action',
        attr: { title: 'Regenerate response' }
      })
      
      regenBtn.onclick = () => {
        this.regenerateResponse(message)
      }
    }
  }

  private renderInputArea(container: HTMLElement) {
    container.empty()

    const inputContainer = container.createDiv('claudian-input-container')
    
    // Input toolbar
    const toolbar = inputContainer.createDiv('claudian-input-toolbar')
    
    // Model selector
    const modelSelect = toolbar.createEl('select', { cls: 'claudian-model-select' })
    modelSelect.createEl('option', { value: 'claude-3-5-sonnet-20241022', text: 'Claude 3.5 Sonnet' })
    modelSelect.createEl('option', { value: 'claude-3-5-haiku-20241022', text: 'Claude 3.5 Haiku' })
    modelSelect.createEl('option', { value: 'claude-3-opus-20240229', text: 'Claude 3 Opus' })
    modelSelect.value = this.plugin.settings.model.modelID
    
    modelSelect.onchange = async () => {
      this.plugin.settings.model.modelID = modelSelect.value
      await this.plugin.saveSettings()
    }

    // Agent selector
    const agentSelect = toolbar.createEl('select', { cls: 'claudian-agent-select' })
    agentSelect.createEl('option', { value: 'assistant', text: 'Assistant' })
    agentSelect.createEl('option', { value: 'bootstrap', text: 'Bootstrap' })
    agentSelect.createEl('option', { value: 'thinking-partner', text: 'Thinking Partner' })
    agentSelect.createEl('option', { value: 'research-assistant', text: 'Research Assistant' })
    agentSelect.createEl('option', { value: 'read-only', text: 'Read Only' })
    agentSelect.value = this.plugin.settings.agent
    
    agentSelect.onchange = async () => {
      this.plugin.settings.agent = agentSelect.value
      await this.plugin.saveSettings()
    }
    
    const textarea = inputContainer.createEl('textarea', {
      cls: 'claudian-input-textarea',
      attr: { placeholder: 'Type your message... (Shift+Enter for new line, Enter to send)' }
    })

    // Input status bar
    const statusBar = inputContainer.createDiv('claudian-input-status')
    const charCount = statusBar.createSpan('claudian-char-count')
    const streamingStatus = statusBar.createSpan('claudian-streaming-status')
    
    // Update character count
    const updateCharCount = () => {
      const count = textarea.value.length
      charCount.textContent = `${count} characters`
      if (count > 8000) {
        charCount.addClass('claudian-char-warning')
      } else {
        charCount.removeClass('claudian-char-warning')
      }
    }
    
    textarea.oninput = updateCharCount
    updateCharCount()

    const buttonContainer = inputContainer.createDiv('claudian-input-buttons')
    
    const sendBtn = buttonContainer.createEl('button', {
      text: this.isStreaming ? 'Stop' : 'Send',
      cls: this.isStreaming ? 'mod-warning' : 'mod-cta'
    })

    const attachBtn = buttonContainer.createEl('button', {
      text: '📎',
      cls: 'claudian-attach-btn',
      attr: { title: 'Attach image' }
    })

    const clearBtn = buttonContainer.createEl('button', {
      text: '🗑️',
      cls: 'claudian-clear-btn',
      attr: { title: 'Clear input' }
    })

    // Update streaming status
    if (this.isStreaming) {
      streamingStatus.textContent = 'Streaming response...'
      streamingStatus.addClass('claudian-streaming')
    } else {
      streamingStatus.textContent = ''
      streamingStatus.removeClass('claudian-streaming')
    }

    // Handle send/stop
    sendBtn.onclick = async () => {
      if (this.isStreaming) {
        this.stopStreaming()
      } else {
        const message = textarea.value.trim()
        if (message) {
          await this.sendMessage(message)
          textarea.value = ''
          updateCharCount()
        }
      }
    }

    // Handle attach (for images)
    attachBtn.onclick = () => {
      this.showAttachmentModal()
    }

    // Handle clear
    clearBtn.onclick = () => {
      if (textarea.value.trim()) {
        new ConfirmationModal(
          this.app,
          'Clear input?',
          'Are you sure you want to clear the current input?',
          () => {
            textarea.value = ''
            updateCharCount()
            textarea.focus()
          }
        ).open()
      }
    }

    // Handle Enter key (Shift+Enter for new line)
    textarea.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendBtn.click()
      }
    }

    // Auto-resize textarea
    textarea.oninput = () => {
      updateCharCount()
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
    }
  }

  private async loadConversations() {
    // In a real implementation, this would load from storage
    // For now, create a default conversation if none exist
    if (this.conversations.length === 0) {
      this.createNewConversation()
    }
  }

  private createNewConversation() {
    const conversation: Conversation = {
      id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      title: `Chat ${new Date().toLocaleString()}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.conversations.unshift(conversation)
    this.activeConversationId = conversation.id
    this.renderView()
  }

  private switchConversation(conversationId: string) {
    this.activeConversationId = conversationId
    this.renderView()
  }

  private getActiveConversation(): Conversation | null {
    return this.conversations.find(c => c.id === this.activeConversationId) || null
  }

  private async sendMessage(content: string) {
    const activeConv = this.getActiveConversation()
    if (!activeConv) {
      this.createNewConversation()
      return this.sendMessage(content)
    }

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: Date.now()
    }
    activeConv.messages.push(userMessage)

    // Create assistant message placeholder
    const assistantMessage: Message = {
      id: `msg-${Date.now()}-assistant`,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }
    activeConv.messages.push(assistantMessage)

    this.isStreaming = true
    this.currentAbortController = new AbortController()
    this.renderView()

    try {
      const responseStream = await this.plugin.sendPrompt(content, {
        sessionId: activeConv.sessionId || undefined,
        abortController: this.currentAbortController
      })

      let fullContent = ''
      for await (const chunk of responseStream) {
        if (this.currentAbortController?.signal.aborted) {
          break
        }

        await this.handleResponseChunk(chunk, assistantMessage)
        
        if (chunk.type === 'text' && chunk.content) {
          fullContent += chunk.content
          assistantMessage.content = fullContent
          this.renderView()
        }

        if (chunk.type === 'session_init' && chunk.sessionId) {
          activeConv.sessionId = chunk.sessionId
        }

        if (chunk.type === 'done') {
          break
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      assistantMessage.content = `Error: ${error.message}`
      new Notice(`Error: ${error.message}`)
    } finally {
      this.isStreaming = false
      this.currentAbortController = null
      this.renderView()
    }
  }

  private async handleResponseChunk(chunk: ResponseChunk, message: Message) {
    switch (chunk.type) {
      case 'text':
        // Text content is handled in sendMessage
        break
      
      case 'thinking':
        // Handle thinking/reasoning display
        this.showThinkingIndicator(chunk.content || '')
        break
      
      case 'tool_use':
        // Handle tool use display
        this.showToolUse({
          id: chunk.id || 'unknown',
          name: chunk.name || 'unknown',
          input: chunk.input || {}
        })
        break
      
      case 'tool_result':
        // Handle tool result display
        this.showToolResult({
          id: chunk.id || 'unknown',
          content: chunk.content || '',
          isError: chunk.isError || false
        })
        break
      
      case 'blocked':
        // Handle permission request blocking
        this.showBlockedIndicator(chunk.content || 'Waiting for permission...')
        break
      
      case 'usage':
        // Handle usage information
        if (chunk.usage) {
          console.log('Token usage:', chunk.usage)
          this.showUsageInfo(chunk.usage)
        }
        break
      
      case 'error':
        throw new Error(chunk.content || 'Unknown error')
    }
  }

  private showThinkingIndicator(content: string) {
    // Show thinking indicator in the UI
    console.log('AI is thinking:', content)
    
    let indicator = this.containerEl.querySelector('.claudian-thinking-indicator') as HTMLElement
    if (!indicator) {
      const messagesContainer = this.containerEl.querySelector('.claudian-messages')
      if (messagesContainer) {
        indicator = messagesContainer.createDiv('claudian-thinking-indicator')
      }
    }
    
    if (indicator) {
      indicator.textContent = `💭 ${content || 'Thinking...'}`
      indicator.style.display = 'block'
      
      // Auto-hide after a delay
      setTimeout(() => {
        if (indicator) {
          indicator.style.display = 'none'
        }
      }, 3000)
    }
  }

  private showBlockedIndicator(content: string) {
    // Show blocked indicator
    let indicator = this.containerEl.querySelector('.claudian-blocked-indicator') as HTMLElement
    if (!indicator) {
      const header = this.containerEl.querySelector('.claudian-header')
      if (header) {
        indicator = header.createDiv('claudian-blocked-indicator')
      }
    }
    
    if (indicator) {
      indicator.textContent = `🔒 ${content}`
      indicator.style.display = 'block'
    }
  }

  private hideBlockedIndicator() {
    const indicator = this.containerEl.querySelector('.claudian-blocked-indicator') as HTMLElement
    if (indicator) {
      indicator.style.display = 'none'
    }
  }

  private showUsageInfo(usage: any) {
    // Show usage information in the status bar or as a temporary notice
    const usageText = `${usage.model}: ${usage.inputTokens} tokens`
    console.log('Usage:', usageText)
    
    // Could show this in a status bar or as a brief notice
    // For now, just log it
  }

  private showToolUse(toolUse: ToolUse) {
    // Show tool use in the UI (could be a modal or inline display)
    console.log('Tool use:', toolUse)
    new Notice(`Using tool: ${toolUse.name}`)
  }

  private showToolResult(toolResult: ToolResult) {
    // Show tool result in the UI
    console.log('Tool result:', toolResult)
    if (toolResult.isError) {
      new Notice(`Tool error: ${toolResult.content}`)
    }
  }

  private stopStreaming() {
    if (this.currentAbortController) {
      this.currentAbortController.abort()
      this.currentAbortController = null
    }
    this.isStreaming = false
    this.renderView()
  }

  private regenerateResponse(message: Message) {
    const activeConv = this.getActiveConversation()
    if (!activeConv) return

    // Find the user message that preceded this assistant message
    const messageIndex = activeConv.messages.findIndex(m => m.id === message.id)
    if (messageIndex <= 0) return

    const userMessage = activeConv.messages[messageIndex - 1]
    if (userMessage.role !== 'user') return

    // Remove the assistant message and regenerate
    activeConv.messages.splice(messageIndex, 1)
    this.sendMessage(userMessage.content)
  }

  private showAttachmentModal() {
    new AttachmentModal(this.app, async (file: File) => {
      try {
        const imageData = await this.fileToBase64(file)
        const activeConv = this.getActiveConversation()
        if (!activeConv) {
          this.createNewConversation()
        }
        
        // Store the image for the next message
        // In a real implementation, you'd want to show a preview
        new Notice(`Image attached: ${file.name}`)
      } catch (error) {
        console.error('Failed to process image:', error)
        new Notice(`Failed to process image: ${error.message}`)
      }
    }).open()
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // Handle server events from the event stream
  handleServerEvent(event: ServerEvent) {
    console.log('View handling server event:', event)
    
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
      
      case 'message.updated':
        this.handleMessageUpdated(event)
        break
      
      case 'session.compacting':
        this.handleSessionCompacting(event)
        break
      
      case 'connection.status':
        this.updateConnectionStatus(event.data?.connected || false)
        break
      
      default:
        console.log('Unhandled view event:', event.type)
    }
  }

  private handleSessionCreated(event: ServerEvent) {
    // Update the active conversation with the new session ID
    const activeConv = this.getActiveConversation()
    if (activeConv && event.data?.sessionId) {
      activeConv.sessionId = event.data.sessionId
    }
  }

  private handleToolExecuteBefore(event: ServerEvent) {
    // Show tool execution indicator
    this.showToolExecutionIndicator(event.data?.tool || 'unknown', true)
  }

  private handleToolExecuteAfter(event: ServerEvent) {
    // Hide tool execution indicator
    this.showToolExecutionIndicator(event.data?.tool || 'unknown', false)
    
    // Show result if available
    if (event.data?.result) {
      this.showToolResult({
        id: event.data.toolId || 'unknown',
        content: typeof event.data.result === 'string' ? event.data.result : JSON.stringify(event.data.result),
        isError: event.data.error || false
      })
    }
  }

  private handleMessageUpdated(event: ServerEvent) {
    // Refresh the messages display
    const messagesContainer = this.containerEl.querySelector('.claudian-messages') as HTMLElement
    if (messagesContainer) {
      this.renderMessages(messagesContainer)
    }
  }

  private handleSessionCompacting(event: ServerEvent) {
    // Show compaction indicator
    this.showCompactionIndicator(true)
    
    // Hide after a delay
    setTimeout(() => {
      this.showCompactionIndicator(false)
    }, 3000)
  }

  updateConnectionStatus(connected: boolean) {
    const statusEl = this.containerEl.querySelector('.claudian-status')
    if (statusEl) {
      statusEl.removeClass('connected', 'disconnected')
      statusEl.addClass(connected ? 'connected' : 'disconnected')
      statusEl.textContent = connected ? '● Connected' : '● Disconnected'
    }
  }

  private showToolExecutionIndicator(toolName: string, show: boolean) {
    let indicator = this.containerEl.querySelector('.claudian-tool-indicator') as HTMLElement
    
    if (show) {
      if (!indicator) {
        const header = this.containerEl.querySelector('.claudian-header')
        if (header) {
          indicator = header.createDiv('claudian-tool-indicator')
        }
      }
      if (indicator) {
        indicator.textContent = `🔧 ${toolName}`
        indicator.style.display = 'block'
      }
    } else {
      if (indicator) {
        indicator.style.display = 'none'
      }
    }
  }

  private showCompactionIndicator(show: boolean) {
    let indicator = this.containerEl.querySelector('.claudian-compaction-indicator') as HTMLElement
    
    if (show) {
      if (!indicator) {
        const header = this.containerEl.querySelector('.claudian-header')
        if (header) {
          indicator = header.createDiv('claudian-compaction-indicator')
        }
      }
      if (indicator) {
        indicator.textContent = '🗜️ Optimizing context...'
        indicator.style.display = 'block'
      }
    } else {
      if (indicator) {
        indicator.style.display = 'none'
      }
    }
  }

  async showPermissionRequest(request: any, requestId: string): Promise<void> {
    return new Promise((resolve) => {
      const modal = new PermissionRequestModal(
        this.app,
        request,
        async () => {
          // Approve the request
          try {
            await this.sendPermissionResponse(requestId, true)
            new Notice('Permission granted')
          } catch (error) {
            console.error('Failed to send permission response:', error)
            new Notice('Failed to send permission response')
          }
          resolve()
        },
        async () => {
          // Deny the request
          try {
            await this.sendPermissionResponse(requestId, false)
            new Notice('Permission denied')
          } catch (error) {
            console.error('Failed to send permission response:', error)
            new Notice('Failed to send permission response')
          }
          resolve()
        }
      )
      modal.open()
    })
  }

  private async sendPermissionResponse(requestId: string, approved: boolean) {
    // Send the permission response back to the server
    const response = await fetch(`${this.plugin.settings.serverUrl}/permission/${requestId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ approved })
    })

    if (!response.ok) {
      throw new Error(`Failed to send permission response: ${response.statusText}`)
    }
  }
}

class AttachmentModal extends Modal {
  private onFileSelect: (file: File) => void

  constructor(app: any, onFileSelect: (file: File) => void) {
    super(app)
    this.onFileSelect = onFileSelect
  }

  onOpen() {
    const { contentEl } = this
    contentEl.createEl('h2', { text: 'Attach Image' })

    const dropZone = contentEl.createDiv('claudian-drop-zone')
    dropZone.textContent = 'Drop an image here or click to select'
    
    const fileInput = contentEl.createEl('input', {
      type: 'file',
      attr: { accept: 'image/*', style: 'display: none' }
    })

    // Handle file selection
    const handleFile = (file: File) => {
      if (!file.type.startsWith('image/')) {
        new Notice('Please select an image file')
        return
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        new Notice('Image file is too large (max 10MB)')
        return
      }
      
      this.onFileSelect(file)
      this.close()
    }

    // Click to select
    dropZone.onclick = () => fileInput.click()
    
    fileInput.onchange = () => {
      const file = fileInput.files?.[0]
      if (file) handleFile(file)
    }

    // Drag and drop
    dropZone.ondragover = (e) => {
      e.preventDefault()
      dropZone.addClass('claudian-drop-zone-hover')
    }
    
    dropZone.ondragleave = () => {
      dropZone.removeClass('claudian-drop-zone-hover')
    }
    
    dropZone.ondrop = (e) => {
      e.preventDefault()
      dropZone.removeClass('claudian-drop-zone-hover')
      
      const file = e.dataTransfer?.files[0]
      if (file) handleFile(file)
    }

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.close())
      )
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}

class ConfirmationModal extends Modal {
  private title: string
  private message: string
  private onConfirm: () => void

  constructor(app: any, title: string, message: string, onConfirm: () => void) {
    super(app)
    this.title = title
    this.message = message
    this.onConfirm = onConfirm
  }

  onOpen() {
    const { contentEl } = this
    contentEl.createEl('h2', { text: this.title })
    contentEl.createEl('p', { text: this.message })

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.close())
      )
      .addButton(btn => btn
        .setButtonText('Confirm')
        .setCta()
        .onClick(() => {
          this.onConfirm()
          this.close()
        })
      )
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}

export class PermissionRequestModal extends Modal {
  private request: {
    type: 'tool_use' | 'bash_command' | 'file_access'
    details: any
  }
  private onApprove: () => void
  private onDeny: () => void

  constructor(
    app: any, 
    request: { type: 'tool_use' | 'bash_command' | 'file_access', details: any },
    onApprove: () => void,
    onDeny: () => void
  ) {
    super(app)
    this.request = request
    this.onApprove = onApprove
    this.onDeny = onDeny
  }

  onOpen() {
    const { contentEl } = this
    
    contentEl.createEl('h2', { text: 'Permission Request' })
    
    const requestInfo = contentEl.createDiv('claudian-permission-request')
    
    switch (this.request.type) {
      case 'tool_use':
        requestInfo.createEl('h3', { text: 'Tool Use Request' })
        requestInfo.createEl('p', { text: `Tool: ${this.request.details.name}` })
        
        const inputPre = requestInfo.createEl('pre')
        inputPre.createEl('code', { text: JSON.stringify(this.request.details.input, null, 2) })
        break
        
      case 'bash_command':
        requestInfo.createEl('h3', { text: 'Bash Command Request' })
        requestInfo.createEl('p', { text: 'The AI wants to execute the following command:' })
        
        const commandPre = requestInfo.createEl('pre')
        commandPre.addClass('claudian-command-preview')
        commandPre.createEl('code', { text: this.request.details.command })
        
        if (this.request.details.workingDirectory) {
          requestInfo.createEl('p', { text: `Working directory: ${this.request.details.workingDirectory}` })
        }
        break
        
      case 'file_access':
        requestInfo.createEl('h3', { text: 'File Access Request' })
        requestInfo.createEl('p', { text: `Operation: ${this.request.details.operation}` })
        requestInfo.createEl('p', { text: `Path: ${this.request.details.path}` })
        break
    }

    const warningEl = contentEl.createDiv('claudian-permission-warning')
    warningEl.createEl('p', { 
      text: '⚠️ Only approve if you trust this action. Malicious commands can harm your system.',
      cls: 'claudian-warning-text'
    })

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Deny')
        .onClick(() => {
          this.onDeny()
          this.close()
        })
      )
      .addButton(btn => btn
        .setButtonText('Approve')
        .setCta()
        .onClick(() => {
          this.onApprove()
          this.close()
        })
      )
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}