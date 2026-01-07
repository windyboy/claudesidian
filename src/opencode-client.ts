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
            ...(options.agent && { agent: options.agent }),
            ...(options.model && { model: options.model }),
          } as any,
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
          type: 'session_init',
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
      const eventStreamPromise = this.client.global.event({
        query: {
          sessionID: sessionId || this.currentSessionId!,
        },
      } as any)

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

      // Await event stream and iterate
      const eventStream = await eventStreamPromise
      let lastMessageId: string | null = null
      for await (const event of eventStream as any) {
        if (options.abortController?.signal.aborted) {
          yield { type: 'done' }
          return
        }

        // Check for tool-related events
        if (event.type === 'tool.use' || event.type === 'tool_use') {
          const toolEvent = (event as any).properties || event
          yield {
            type: 'tool_use',
            id: toolEvent.id || toolEvent.tool_use_id || `tool-${Date.now()}`,
            name: toolEvent.name || 'unknown',
            input: toolEvent.input || {},
            sessionId: sessionId || this.currentSessionId!,
          }
          continue
        }

        if (event.type === 'tool.result' || event.type === 'tool_result') {
          const resultEvent = (event as any).properties || event
          yield {
            type: 'tool_result',
            id: resultEvent.tool_use_id || resultEvent.id || null,
            content:
              typeof resultEvent.result === 'string'
                ? resultEvent.result
                : JSON.stringify(resultEvent.result || '', null, 2),
            isError: resultEvent.is_error || false,
            sessionId: sessionId || this.currentSessionId!,
          }
          continue
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
                } else if (part.type === 'reasoning') {
                  yield {
                    type: 'thinking',
                    content: part.text || '',
                    sessionId: message.sessionID,
                  }
                } else {
                  // Check for tool_use or tool_result in part data (may be nested)
                  const partAny = part as any
                  if (partAny.tool_use_id || partAny.name) {
                    // Handle tool_use parts
                    yield {
                      type: 'tool_use',
                      id: partAny.tool_use_id || partAny.id || `tool-${Date.now()}`,
                      name: partAny.name || 'unknown',
                      input: partAny.input || {},
                      sessionId: message.sessionID,
                    }
                  } else if (partAny.result !== undefined || partAny.tool_use_id) {
                    // Handle tool_result parts
                    yield {
                      type: 'tool_result',
                      id: partAny.tool_use_id || partAny.id || null,
                      content:
                        typeof partAny.result === 'string'
                          ? partAny.result
                          : JSON.stringify(partAny.result || partAny.content || '', null, 2),
                      isError: partAny.is_error || false,
                      sessionId: message.sessionID,
                    }
                  }
                }
              }
              
              // Check for toolCalls in message data (alternative structure)
              if ((messageResult.data as any).toolCalls) {
                for (const toolCall of (messageResult.data as any).toolCalls) {
                  yield {
                    type: 'tool_use',
                    id: toolCall.id || toolCall.tool_use_id || `tool-${Date.now()}`,
                    name: toolCall.name || 'unknown',
                    input: toolCall.input || {},
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
                    model: `${message.providerID || 'unknown'}:${message.modelID || 'unknown'}`,
                    inputTokens: message.tokens.input,
                    contextTokens: message.tokens.input + (message.tokens.cache?.write || 0) + (message.tokens.cache?.read || 0),
                    ...(message.tokens.cache?.write && { cacheCreationInputTokens: message.tokens.cache.write }),
                    ...(message.tokens.cache?.read && { cacheReadInputTokens: message.tokens.cache.read }),
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

