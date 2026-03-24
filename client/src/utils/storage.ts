import { DEFAULT_PERSISTED_STATE, STORAGE_VERSION } from '@shared/constants'
import type { PersistedChatState } from '@shared/types'

const STORAGE_KEY = 'ai-chat-platform-state'

export const loadState = (): PersistedChatState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return DEFAULT_PERSISTED_STATE
    }

    const parsed = JSON.parse(raw) as PersistedChatState
    if (parsed.version !== STORAGE_VERSION) {
      return DEFAULT_PERSISTED_STATE
    }

    return parsed
  } catch {
    return DEFAULT_PERSISTED_STATE
  }
}

export const saveState = (state: PersistedChatState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
