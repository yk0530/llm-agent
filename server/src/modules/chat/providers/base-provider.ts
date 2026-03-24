import { AppError } from '../../../errors.js'
import type {
  ProviderChatCompletion,
  ProviderChatMessage,
  ProviderChatRequest,
  ProviderToolCall,
  StreamHandlers
} from '../chat.types.js'

interface ProviderConfig {
  apiKey: string
  baseUrl: string
  providerName: string
}

interface ChatCompletionMessagePayload {
  content?: string | Array<{ type?: string; text?: string }>
  tool_calls?: Array<{
    id?: string
    type?: 'function'
    function?: {
      name?: string
      arguments?: string
    }
  }>
}

export abstract class BaseProviderAdapter {
  protected readonly apiKey: string
  protected readonly baseUrl: string
  protected readonly providerName: string

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl
    this.providerName = config.providerName
  }

  async completeChat(request: ProviderChatRequest, signal?: AbortSignal): Promise<ProviderChatCompletion> {
    this.ensureApiKey()

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(this.buildRequestBody(request, false))
    })

    if (!response.ok) {
      const message = await this.readErrorMessage(response)
      throw new AppError(message, response.status)
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: ChatCompletionMessagePayload
      }>
    }

    const message = payload.choices?.[0]?.message
    if (!message) {
      throw new AppError(`${this.providerName} 未返回有效内容`, 502)
    }

    return {
      content: this.extractMessageContent(message),
      toolCalls: this.extractToolCalls(message)
    }
  }

  async streamChat(request: ProviderChatRequest, handlers: StreamHandlers, signal?: AbortSignal) {
    this.ensureApiKey()

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(this.buildRequestBody(request, true))
    })

    if (!response.ok) {
      const message = await this.readErrorMessage(response)
      throw new AppError(message, response.status)
    }

    if (!response.body) {
      throw new AppError(`${this.providerName} 未返回可读取的数据流`, 502)
    }

    await this.consumeStream(response.body, handlers)
    handlers.onDone()
  }

  protected buildRequestBody(request: ProviderChatRequest, stream: boolean) {
    const messages = request.systemPrompt
      ? [{ role: 'system' as const, content: request.systemPrompt }, ...request.messages]
      : request.messages

    return {
      model: request.model,
      stream,
      messages: messages.map((message) => this.serializeMessage(message)),
      ...(request.tools ? { tools: request.tools } : {}),
      ...(request.toolChoice ? { tool_choice: request.toolChoice } : {}),
      ...(request.responseFormat
        ? {
            response_format: {
              type: request.responseFormat
            }
          }
        : {})
    }
  }

  protected extractToken(data: unknown): string {
    const payload = data as {
      choices?: Array<{
        delta?: { content?: string }
        message?: { content?: string }
      }>
    }

    return payload.choices?.[0]?.delta?.content || payload.choices?.[0]?.message?.content || ''
  }

  private serializeMessage(message: ProviderChatMessage) {
    if (message.role === 'assistant') {
      return {
        role: message.role,
        content: message.content ?? '',
        ...(message.toolCalls
          ? {
              tool_calls: message.toolCalls.map((toolCall) => ({
                id: toolCall.id,
                type: toolCall.type,
                function: {
                  name: toolCall.function.name,
                  arguments: toolCall.function.arguments
                }
              }))
            }
          : {})
      }
    }

    if (message.role === 'tool') {
      return {
        role: 'tool',
        content: message.content,
        tool_call_id: message.toolCallId
      }
    }

    return message
  }

  private extractMessageContent(message: ChatCompletionMessagePayload) {
    const content = message.content

    if (typeof content === 'string') {
      return content
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => (part.type === 'text' ? part.text || '' : ''))
        .join('')
        .trim()
    }

    return ''
  }

  private extractToolCalls(message: ChatCompletionMessagePayload): ProviderToolCall[] {
    return (message.tool_calls || [])
      .map((toolCall) => {
        if (
          !toolCall.id ||
          toolCall.type !== 'function' ||
          !toolCall.function?.name ||
          typeof toolCall.function.arguments !== 'string'
        ) {
          return null
        }

        return {
          id: toolCall.id,
          type: 'function' as const,
          function: {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments
          }
        }
      })
      .filter((toolCall): toolCall is ProviderToolCall => Boolean(toolCall))
  }

  private async consumeStream(stream: ReadableStream<Uint8Array>, handlers: StreamHandlers) {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n')
      buffer = parts.pop() ?? ''

      for (const line of parts) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) {
          continue
        }

        const raw = trimmed.replace(/^data:\s*/, '')
        if (!raw || raw === '[DONE]') {
          continue
        }

        try {
          const parsed = JSON.parse(raw)
          const token = this.extractToken(parsed)
          if (token) {
            handlers.onToken(token)
          }
        } catch {
          continue
        }
      }
    }
  }

  private ensureApiKey() {
    if (!this.apiKey) {
      throw new AppError(`${this.providerName} API Key 未配置`, 500)
    }
  }

  private async readErrorMessage(response: Response) {
    try {
      const json = await response.json()
      return json?.error?.message || json?.message || `${this.providerName} 请求失败`
    } catch {
      return `${this.providerName} 请求失败`
    }
  }
}
