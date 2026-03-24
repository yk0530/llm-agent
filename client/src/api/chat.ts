import type {
  ChatRequestBody,
  ChatSessionsResponse,
  ChatSession,
  CreateSessionBody,
  DoneStreamEvent,
  ErrorStreamEvent,
  StartStreamEvent,
  TokenStreamEvent
} from '@shared/types'

interface StreamCallbacks {
  onStart?: (payload: StartStreamEvent) => void
  onToken?: (payload: TokenStreamEvent) => void
  onDone?: (payload: DoneStreamEvent) => void
  onError?: (payload: ErrorStreamEvent) => void
}

const createHeaders = (clientId: string, extraHeaders?: HeadersInit) => ({
  'Content-Type': 'application/json',
  'x-client-id': clientId,
  ...(extraHeaders || {})
})

const readErrorMessage = async (response: Response) => {
  const raw = await response.text()

  if (!raw) {
    return '请求失败'
  }

  try {
    const parsed = JSON.parse(raw) as { message?: string }
    return parsed.message || raw
  } catch {
    return raw
  }
}

const requestJson = async <T>(
  apiBaseUrl: string,
  clientId: string,
  path: string,
  init?: RequestInit
) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: createHeaders(clientId, init?.headers)
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

const parseEventStream = (buffer: string) => {
  const chunks = buffer.split('\n\n')

  return {
    chunks: chunks.slice(0, -1),
    rest: chunks.at(-1) ?? ''
  }
}

const parseEventChunk = (chunk: string) => {
  const lines = chunk.split('\n')
  const event = lines.find((line) => line.startsWith('event:'))?.replace('event:', '').trim()
  const data = lines.find((line) => line.startsWith('data:'))?.replace('data:', '').trim()

  if (!event || !data) {
    return null
  }

  try {
    return {
      event,
      data: JSON.parse(data)
    }
  } catch {
    return null
  }
}

export const fetchSessions = async (apiBaseUrl: string, clientId: string) => {
  const response = await requestJson<ChatSessionsResponse>(apiBaseUrl, clientId, '/api/chat/sessions')
  return response.sessions
}

export const createSession = async (
  apiBaseUrl: string,
  clientId: string,
  payload: CreateSessionBody
) => {
  return requestJson<ChatSession>(apiBaseUrl, clientId, '/api/chat/sessions', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export const deleteSession = async (apiBaseUrl: string, clientId: string, sessionId: string) => {
  await requestJson<void>(apiBaseUrl, clientId, `/api/chat/sessions/${sessionId}`, {
    method: 'DELETE'
  })
}

export const streamChat = async (
  apiBaseUrl: string,
  clientId: string,
  payload: ChatRequestBody,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
) => {
  const response = await fetch(`${apiBaseUrl}/api/chat/stream`, {
    method: 'POST',
    headers: createHeaders(clientId),
    body: JSON.stringify(payload),
    signal
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  if (!response.body) {
    throw new Error('未收到流式响应')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const parsed = parseEventStream(buffer)
    buffer = parsed.rest

    for (const chunk of parsed.chunks) {
      const event = parseEventChunk(chunk)
      if (!event) {
        continue
      }

      if (event.event === 'start') {
        callbacks.onStart?.(event.data as StartStreamEvent)
      }

      if (event.event === 'token') {
        callbacks.onToken?.(event.data as TokenStreamEvent)
      }

      if (event.event === 'done') {
        callbacks.onDone?.(event.data as DoneStreamEvent)
      }

      if (event.event === 'error') {
        callbacks.onError?.(event.data as ErrorStreamEvent)
      }
    }
  }
}
