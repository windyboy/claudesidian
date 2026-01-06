import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk/client'
import type { SessionPromptData, SessionPromptResponses } from '@opencode-ai/sdk'

export interface OpenCodeClientConfig {
  serverUrl?: string
  timeout?: number
}

export interface ResponseChunk {
  type: 'text' | 'usage' | 'error' | 'done' | 'session_init' | 'thinking' | 'tool_use' | 'tool_result' | 'blocked'
  content?: string
  sessionId?: string
  usage?: {
    model: string
    inputTokens: number
    cacheCreationInputTokens?: number
    cacheReadInputTokens?: number
    contextWindow?: number
    contextTokens?: number
    percentage?: number
  }
  parentToolUseId?: string | null
  id?: string
  name?: string
  input?: unknown
  isError?: boolean
}

export class OpenCodeClient {
  private client: OpencodeClient | null = null
  private serverUrl: string
  private timeout: number
  private isConnecting = false
  private currentSessionId: string | null = null

  constructor(config: OpenCodeClientConfig = {}) {
    this.serverUrl = config.serverUrl || 'http://localhost:4096'
    this.timeout = config.timeout || 30000
  }

  get isConnected(): boolean {
    return this.client !== null
  }

  async connect(): Promise<void> {
    if (this.client) {
      return
    }

    if (this.isConnecting) {
      throw new Error('Connection already in progress')
    }

    this.isConnecting = true

    try {
      // Verify server is reachable
      const healthCheck = await this.healthCheck()
      if (!healthCheck) {
        throw new Error(
          `OpenCode server is not running at ${this.serverUrl}. Please start the server with 'opencode server' or check the server URL in settings.`
        )
      }

      // Create client
      this.client = createOpencodeClient({
        baseUrl: this.serverUrl,
      })

      this.isConnecting = false
    } catch (error) {
      this.isConnecting = false
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          throw new Error(
            `Failed to connect to OpenCode server at ${this.serverUrl}. Please ensure the server is running.`
          )
        }
        throw error
      }
      throw new Error('Unknown error connecting to OpenCode server')
    }
  }

  disconnect(): void {
    this.client = null
    this.currentSessionId = null
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      // Server not reachable or health endpoint doesn't exist
      return false
    }
  }

  async *sendPrompt(
    prompt: string | Array<{ type: string; text?: string; [key: string]: unknown }>,
    options: {
      sessionId?: string
      model?: { providerID: string; modelID: string }
      agent?: string
      system?: string
      tools?: { [key: string]: boolean }
      cwd?: string
      abortController?: AbortController
    } = {}
  ): AsyncGenerator<ResponseChunk> {
    if (!this.client) {
      await this.connect()
    }

    if (!this.client) {
      yield {
        type: 'error',
        content: 'OpenCode server connection failed. Please check your server URL in settings.',
      }
      return
    }

    const sessionId = options.sessionId || this.currentSessionId

    try {
      // If no session, create one
      if (!sessionId) {
        const createResult = await this.client.session.create({
          body: {
            agent: options.agent,
            model: options.model,
          },
        })

        if (createResult.error) {
          yield {
            type: 'error',
            content: `Failed to create session: ${createResult.error}`,
          }
          return
        }

        this.currentSessionId = createResult.data.id
        yield {
          type: 'session',
          sessionId: this.currentSessionId,
        }
      }

      // Convert prompt to parts format
      const parts: Array<{ type: 'text'; text: string }> = []
      if (typeof prompt === 'string') {
        parts.push({ type: 'text', text: prompt })
      } else {
        for (const item of prompt) {
          if (item.type === 'text' && item.text) {
            parts.push({ type: 'text', text: item.text })
          } else if (item.type === 'image' && 'data' in item) {
            // Handle images - would need to convert to file part or handle differently
            // For now, skip images or convert to text description
          }
        }
      }

      // Subscribe to events for streaming before sending prompt
      const eventStream = this.client.global.event({
        query: {
          sessionID: sessionId || this.currentSessionId,
        },
      })

      // Send prompt asynchronously
      const promptResult = await this.client.session.promptAsync({
        path: {
          id: sessionId || this.currentSessionId!,
        },
        body: {
          messageID: undefined,
          model: options.model,
          agent: options.agent,
          system: options.system,
          tools: options.tools,
          parts: parts,
        },
        query: options.cwd ? { directory: options.cwd } : undefined,
      })

      if (promptResult.error) {
        yield {
          type: 'error',
          content: `Failed to send prompt: ${JSON.stringify(promptResult.error)}`,
        }
        return
      }

      // Stream events
      let lastMessageId: string | null = null
      for await (const event of eventStream) {
        if (options.abortController?.signal.aborted) {
          yield { type: 'done' }
          return
        }

        if (event.type === 'message.updated') {
          const message = event.properties.info
          if (message.role === 'assistant' && message.id !== lastMessageId) {
            lastMessageId = message.id

            // Get message parts
            const messageResult = await this.client!.session.message({
              path: {
                id: sessionId || this.currentSessionId!,
                messageID: message.id,
              },
            })

            if (messageResult.data) {
              for (const part of messageResult.data.parts) {
                if (part.type === 'text') {
                  yield {
                    type: 'text',
                    content: part.text,
                    sessionId: message.sessionID,
                  }
                }
              }

              // Yield usage info
              if (message.tokens) {
                yield {
                  type: 'usage',
                  sessionId: message.sessionID,
                  usage: {
                    input: message.tokens.input,
                    output: message.tokens.output,
                    reasoning: message.tokens.reasoning || 0,
                  },
                }
              }
            }

            // Check if message is complete
            if (message.time.completed) {
              yield { type: 'done' }
              return
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          yield { type: 'done' }
          return
        }
        yield {
          type: 'error',
          content: error.message,
        }
      } else {
        yield {
          type: 'error',
          content: 'Unknown error occurred',
        }
      }
    }
  }

  setSessionId(sessionId: string | null): void {
    this.currentSessionId = sessionId
  }

  getSessionId(): string | null {
    return this.currentSessionId
  }
}

