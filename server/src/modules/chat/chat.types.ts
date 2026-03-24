import type { ModelProvider } from '../../../../shared/types.js'

export interface StreamHandlers {
  onToken: (token: string) => void
  onDone: () => void
}

export interface ProviderChatRequest {
  provider: ModelProvider
  model: string
  systemPrompt?: string
  responseFormat?: 'json_object'
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
}

export interface ChatProviderAdapter {
  completeChat: (request: ProviderChatRequest, signal?: AbortSignal) => Promise<string>
  streamChat: (
    request: ProviderChatRequest,
    handlers: StreamHandlers,
    signal?: AbortSignal
  ) => Promise<void>
}
