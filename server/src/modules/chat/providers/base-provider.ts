import { AppError } from '../../../errors.js'
import type { ProviderChatRequest, StreamHandlers } from '../chat.types.js'

interface ProviderConfig {
  apiKey: string
  baseUrl: string
  providerName: string
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

  async completeChat(request: ProviderChatRequest, signal?: AbortSignal) {
    if (!this.apiKey) {
      throw new AppError(`${this.providerName} API Key 未配置`, 500)
    }

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
        message?: {
          content?: string | Array<{ type?: string; text?: string }>
        }
      }>
    }

    const content = this.extractMessageContent(payload)

    if (!content) {
      throw new AppError(`${this.providerName} 未返回有效内容`, 502)
    }

    return content
  }

  async streamChat(request: ProviderChatRequest, handlers: StreamHandlers, signal?: AbortSignal) {
    if (!this.apiKey) {
      throw new AppError(`${this.providerName} API Key 未配置`, 500)
    }

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
      messages,
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

  private extractMessageContent(data: unknown) {
    const payload = data as {
      choices?: Array<{
        message?: {
          content?: string | Array<{ type?: string; text?: string }>
        }
      }>
    }

    const content = payload.choices?.[0]?.message?.content

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

  private async readErrorMessage(response: Response) {
    try {
      const json = await response.json()
      return json?.error?.message || json?.message || `${this.providerName} 请求失败`
    } catch {
      return `${this.providerName} 请求失败`
    }
  }
}
