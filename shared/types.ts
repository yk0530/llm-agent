export type ChatRole = 'system' | 'user' | 'assistant'
export type ChatMessageStatus = 'streaming' | 'done' | 'error'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  updatedAt: string
  status: ChatMessageStatus
  errorMessage?: string | null
}

export type ModelProvider = 'openai' | 'deepseek'

export interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  provider: ModelProvider
  model: string
  systemPrompt: string
  messages: ChatMessage[]
}

export interface ChatRequestBody {
  sessionId?: string
  provider: ModelProvider
  model: string
  message: string
  systemPrompt?: string
}

export interface CreateSessionBody {
  provider: ModelProvider
  model: string
  systemPrompt?: string
}

export interface ChatSessionsResponse {
  sessions: ChatSession[]
}

export interface ChatSettings {
  provider: ModelProvider
  model: string
  apiBaseUrl: string
  systemPrompt: string
}

export interface PersistedChatState {
  version: number
  clientId: string
  activeSessionId: string | null
  sessions: ChatSession[]
  settings: ChatSettings
  draft: string
}

export type StreamEventName = 'start' | 'token' | 'done' | 'error'

export interface StartStreamEvent {
  requestId: string
  session: ChatSession
  assistantMessageId: string
}

export interface TokenStreamEvent {
  assistantMessageId: string
  token: string
}

export interface DoneStreamEvent {
  requestId: string
  sessionId: string
  assistantMessageId: string
}

export interface ErrorStreamEvent {
  message: string
  sessionId?: string
  assistantMessageId?: string
}
