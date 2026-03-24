import { computed, ref, watch } from 'vue'
import { PROVIDER_MODEL_OPTIONS } from '@shared/constants'
import type {
  ChatMessage,
  ChatRequestBody,
  ChatSession,
  ChatSettings,
  PersistedChatState
} from '@shared/types'
import {
  createSession as createSessionRequest,
  deleteSession as deleteSessionRequest,
  fetchSessions,
  streamChat
} from '@/api/chat'
import { createId } from '@/utils/id'
import { loadState, saveState } from '@/utils/storage'

const API_FALLBACK = 'http://localhost:3000'
const FAILED_MESSAGE = '请求失败，请稍后重试。'
const STOPPED_MESSAGE = '生成已手动停止。'

const compareByUpdatedAt = (a: ChatSession, b: ChatSession) => b.updatedAt.localeCompare(a.updatedAt)

const getApiBaseUrl = (settings: ChatSettings) => settings.apiBaseUrl || API_FALLBACK

const ensureClientId = (state: PersistedChatState) => {
  if (state.clientId) {
    return state
  }

  return {
    ...state,
    clientId: createId()
  }
}

const mergeSession = (sessions: ChatSession[], nextSession: ChatSession) => {
  return [...sessions.filter((session) => session.id !== nextSession.id), nextSession].sort(compareByUpdatedAt)
}

const syncSettingsFromSession = (state: PersistedChatState, session: ChatSession | null) => {
  if (!session) {
    return
  }

  state.settings = {
    ...state.settings,
    provider: session.provider,
    model: session.model,
    systemPrompt: session.systemPrompt
  }
}

const updateMessageInSession = (
  state: PersistedChatState,
  sessionId: string,
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage
) => {
  state.sessions = state.sessions.map((session) => {
    if (session.id !== sessionId) {
      return session
    }

    return {
      ...session,
      updatedAt: new Date().toISOString(),
      messages: session.messages.map((message) => (message.id === messageId ? updater(message) : message))
    }
  })
}

export const useChatApp = () => {
  const persisted = ref<PersistedChatState>(ensureClientId(loadState()))
  const isStreaming = ref(false)
  const isHydrating = ref(false)
  const errorMessage = ref('')
  const abortController = ref<AbortController | null>(null)
  const activeAssistantMessageId = ref<string | null>(null)
  const pendingSessionId = ref<string | null>(null)

  const sessions = computed(() => persisted.value.sessions)
  const draft = computed({
    get: () => persisted.value.draft,
    set: (value: string) => {
      persisted.value.draft = value
    }
  })
  const settings = computed({
    get: () => persisted.value.settings,
    set: (value: ChatSettings) => {
      persisted.value.settings = value
    }
  })

  const activeSession = computed(() => {
    return (
      sessions.value.find((session) => session.id === persisted.value.activeSessionId) ||
      sessions.value[0] ||
      null
    )
  })

  const applySessions = (nextSessions: ChatSession[]) => {
    persisted.value.sessions = [...nextSessions].sort(compareByUpdatedAt)

    if (
      persisted.value.activeSessionId &&
      !persisted.value.sessions.some((session) => session.id === persisted.value.activeSessionId)
    ) {
      persisted.value.activeSessionId = persisted.value.sessions[0]?.id ?? null
    }

    if (!persisted.value.activeSessionId) {
      persisted.value.activeSessionId = persisted.value.sessions[0]?.id ?? null
    }

    syncSettingsFromSession(persisted.value, activeSession.value)
  }

  const refreshSessions = async () => {
    isHydrating.value = true

    try {
      const remoteSessions = await fetchSessions(
        getApiBaseUrl(persisted.value.settings),
        persisted.value.clientId
      )
      applySessions(remoteSessions)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : FAILED_MESSAGE
    } finally {
      isHydrating.value = false
    }
  }

  const createNewSession = async () => {
    if (isStreaming.value) {
      return
    }

    errorMessage.value = ''

    try {
      const session = await createSessionRequest(getApiBaseUrl(settings.value), persisted.value.clientId, {
        provider: settings.value.provider,
        model: settings.value.model,
        systemPrompt: settings.value.systemPrompt || undefined
      })

      persisted.value.sessions = mergeSession(persisted.value.sessions, session)
      persisted.value.activeSessionId = session.id
      persisted.value.draft = ''
      syncSettingsFromSession(persisted.value, session)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : FAILED_MESSAGE
    }
  }

  const selectSession = (sessionId: string) => {
    persisted.value.activeSessionId = sessionId
    errorMessage.value = ''
    syncSettingsFromSession(
      persisted.value,
      persisted.value.sessions.find((session) => session.id === sessionId) || null
    )
  }

  const deleteSession = async (sessionId: string) => {
    try {
      await deleteSessionRequest(getApiBaseUrl(settings.value), persisted.value.clientId, sessionId)
      persisted.value.sessions = persisted.value.sessions.filter((session) => session.id !== sessionId)

      if (persisted.value.activeSessionId === sessionId) {
        persisted.value.activeSessionId = persisted.value.sessions[0]?.id ?? null
      }

      syncSettingsFromSession(persisted.value, activeSession.value)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : FAILED_MESSAGE
    }
  }

  const updateSettings = (patch: Partial<ChatSettings>) => {
    const nextProvider = patch.provider ?? settings.value.provider
    const defaultModel = PROVIDER_MODEL_OPTIONS[nextProvider][0]

    persisted.value.settings = {
      ...settings.value,
      ...patch,
      model:
        patch.provider && !patch.model
          ? defaultModel
          : patch.model ?? persisted.value.settings.model
    }
  }

  const sendMessage = async () => {
    const content = draft.value.trim()
    if (!content || isStreaming.value) {
      return
    }

    errorMessage.value = ''
    isStreaming.value = true
    draft.value = ''
    activeAssistantMessageId.value = null
    pendingSessionId.value = null

    const controller = new AbortController()
    abortController.value = controller

    const body: ChatRequestBody = {
      sessionId: activeSession.value?.id ?? undefined,
      provider: settings.value.provider,
      model: settings.value.model,
      message: content,
      systemPrompt: settings.value.systemPrompt || undefined
    }

    try {
      await streamChat(
        getApiBaseUrl(settings.value),
        persisted.value.clientId,
        body,
        {
          onStart: (payload) => {
            activeAssistantMessageId.value = payload.assistantMessageId
            pendingSessionId.value = payload.session.id
            persisted.value.sessions = mergeSession(persisted.value.sessions, payload.session)
            persisted.value.activeSessionId = payload.session.id
            syncSettingsFromSession(persisted.value, payload.session)
          },
          onToken: ({ assistantMessageId, token }) => {
            const targetSessionId = pendingSessionId.value
            if (!targetSessionId) {
              return
            }

            updateMessageInSession(persisted.value, targetSessionId, assistantMessageId, (message) => ({
              ...message,
              content: `${message.content}${token}`,
              status: 'streaming',
              updatedAt: new Date().toISOString(),
              errorMessage: null
            }))
          },
          onDone: ({ sessionId, assistantMessageId }) => {
            updateMessageInSession(persisted.value, sessionId, assistantMessageId, (message) => ({
              ...message,
              status: 'done',
              updatedAt: new Date().toISOString(),
              errorMessage: null
            }))
          },
          onError: ({ message, sessionId, assistantMessageId }) => {
            errorMessage.value = message || FAILED_MESSAGE

            if (sessionId && assistantMessageId) {
              updateMessageInSession(
                persisted.value,
                sessionId,
                assistantMessageId,
                (currentMessage) => ({
                  ...currentMessage,
                  content: currentMessage.content.trim() || message || FAILED_MESSAGE,
                  status: 'error',
                  updatedAt: new Date().toISOString(),
                  errorMessage: message || FAILED_MESSAGE
                })
              )
            }
          }
        },
        controller.signal
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        errorMessage.value = STOPPED_MESSAGE

        if (pendingSessionId.value && activeAssistantMessageId.value) {
          updateMessageInSession(
            persisted.value,
            pendingSessionId.value,
            activeAssistantMessageId.value,
            (message) => ({
              ...message,
              content: message.content.trim() || STOPPED_MESSAGE,
              status: 'error',
              updatedAt: new Date().toISOString(),
              errorMessage: STOPPED_MESSAGE
            })
          )
        }
      } else {
        errorMessage.value = error instanceof Error ? error.message : FAILED_MESSAGE
      }
    } finally {
      isStreaming.value = false
      abortController.value = null
      activeAssistantMessageId.value = null
      pendingSessionId.value = null
    }
  }

  const stopStream = () => {
    abortController.value?.abort()
    isStreaming.value = false
  }

  watch(
    persisted,
    (value) => {
      saveState(value)
    },
    { deep: true }
  )

  void refreshSessions()

  return {
    activeSession,
    createNewSession,
    deleteSession,
    draft,
    errorMessage,
    isHydrating,
    isStreaming,
    selectSession,
    sendMessage,
    sessions,
    settings,
    stopStream,
    updateSettings
  }
}
