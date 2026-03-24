import type { ModelProvider } from '../../../../shared/types.js'

export interface StreamHandlers {
  onToken: (token: string) => void
  onDone: () => void
}

export interface FunctionToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
    strict?: boolean
  }
}

export interface ProviderToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export type ProviderChatMessage =
  | {
      role: 'system' | 'user'
      content: string
    }
  | {
      role: 'assistant'
      content?: string
      toolCalls?: ProviderToolCall[]
    }
  | {
      role: 'tool'
      content: string
      toolCallId: string
    }

export interface ProviderChatRequest {
  provider: ModelProvider
  model: string
  systemPrompt?: string
  responseFormat?: 'json_object'
  toolChoice?: 'auto' | 'none'
  tools?: FunctionToolDefinition[]
  messages: ProviderChatMessage[]
}

export interface ProviderChatCompletion {
  content: string
  toolCalls: ProviderToolCall[]
}

export interface ChatProviderAdapter {
  completeChat: (request: ProviderChatRequest, signal?: AbortSignal) => Promise<ProviderChatCompletion>
  streamChat: (
    request: ProviderChatRequest,
    handlers: StreamHandlers,
    signal?: AbortSignal
  ) => Promise<void>
}
