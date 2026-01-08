export interface ClaudianSettings {
  serverUrl: string
  timeout: number
  agent: string
  model: {
    providerID: string
    modelID: string
  }
  autoConnect: boolean
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  images?: ImageAttachment[]
}

export interface ImageAttachment {
  data: string
  mimeType: string
  name?: string
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  sessionId?: string | null
}

export interface ToolUse {
  id: string
  name: string
  input: unknown
}

export interface ToolResult {
  id: string
  content: string
  isError: boolean
}

export interface ServerEvent {
  type: string
  data?: any
  sessionId?: string
  timestamp?: number
}