import type { ChatSettings, PersistedChatState } from './types'

export const STORAGE_VERSION = 2

export const DEFAULT_SETTINGS: ChatSettings = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiBaseUrl: '',
  systemPrompt: ''
}

export const DEFAULT_PERSISTED_STATE: PersistedChatState = {
  version: STORAGE_VERSION,
  clientId: '',
  activeSessionId: null,
  sessions: [],
  settings: DEFAULT_SETTINGS,
  draft: ''
}

export const PROVIDER_MODEL_OPTIONS = {
  openai: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner']
} as const
