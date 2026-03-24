import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import type { ChatMessage, ChatSession, ModelProvider } from '../../../../shared/types.js'
import { AppError } from '../../errors.js'
import type { ProviderChatRequest } from './chat.types.js'

interface SessionRow {
  id: string
  client_id: string
  title: string
  provider: ModelProvider
  model: string
  system_prompt: string
  created_at: string
  updated_at: string
}

interface MessageRow {
  id: string
  session_id: string
  role: ChatMessage['role']
  content: string
  status: ChatMessage['status']
  error_message: string | null
  created_at: string
  updated_at: string
}

interface CreateSessionInput {
  clientId: string
  provider: ModelProvider
  model: string
  systemPrompt?: string
  title?: string
}

export interface BeginStreamResult {
  session: ChatSession
  assistantMessageId: string
  modelRequest: ProviderChatRequest
}

const DEFAULT_DB_PATH = './data/chat.sqlite'

const nowIso = () => new Date().toISOString()

const generateSessionTitle = (text: string) => {
  const cleaned = text.replace(/\s+/g, ' ').trim()

  if (!cleaned) {
    return '新会话'
  }

  return cleaned.length > 24 ? `${cleaned.slice(0, 24)}...` : cleaned
}

export class ChatRepository {
  constructor(private readonly db: Database.Database) {
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        title TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        system_prompt TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chat_sessions_client_updated_at
        ON chat_sessions (client_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created_at
        ON chat_messages (session_id, created_at ASC);
    `)
  }

  listSessions(clientId: string) {
    const sessionRows = this.db
      .prepare(
        `
          SELECT id, client_id, title, provider, model, system_prompt, created_at, updated_at
          FROM chat_sessions
          WHERE client_id = ?
          ORDER BY updated_at DESC
        `
      )
      .all(clientId) as SessionRow[]

    return sessionRows.map((row) => this.hydrateSession(row))
  }

  createSession(input: CreateSessionInput) {
    const sessionId = randomUUID()
    const timestamp = nowIso()

    this.db
      .prepare(
        `
          INSERT INTO chat_sessions (
            id, client_id, title, provider, model, system_prompt, created_at, updated_at
          ) VALUES (
            @id, @clientId, @title, @provider, @model, @systemPrompt, @createdAt, @updatedAt
          )
        `
      )
      .run({
        id: sessionId,
        clientId: input.clientId,
        title: input.title || '新会话',
        provider: input.provider,
        model: input.model,
        systemPrompt: input.systemPrompt || '',
        createdAt: timestamp,
        updatedAt: timestamp
      })

    return this.getSessionOrThrow(input.clientId, sessionId)
  }

  deleteSession(clientId: string, sessionId: string) {
    const result = this.db
      .prepare(
        `
          DELETE FROM chat_sessions
          WHERE id = ? AND client_id = ?
        `
      )
      .run(sessionId, clientId)

    if (result.changes === 0) {
      throw new AppError('会话不存在', 404)
    }
  }

  beginAssistantResponse(input: {
    clientId: string
    sessionId?: string
    provider: ModelProvider
    model: string
    systemPrompt?: string
    message: string
  }): BeginStreamResult {
    const assistantMessageId = randomUUID()

    const result = this.db.transaction(() => {
      const timestamp = nowIso()
      const trimmedMessage = input.message.trim()
      const providedSystemPrompt = input.systemPrompt || ''
      let sessionId = input.sessionId
      let existingMessageCount = 0

      if (sessionId) {
        const sessionRow = this.findSessionRow(input.clientId, sessionId)
        if (!sessionRow) {
          throw new AppError('会话不存在', 404)
        }

        existingMessageCount = this.countMessages(sessionId)
        this.db
          .prepare(
            `
              UPDATE chat_sessions
              SET provider = @provider,
                  model = @model,
                  system_prompt = @systemPrompt,
                  updated_at = @updatedAt
              WHERE id = @id
            `
          )
          .run({
            id: sessionId,
            provider: input.provider,
            model: input.model,
            systemPrompt: providedSystemPrompt,
            updatedAt: timestamp
          })
      } else {
        const createdSession = this.createSession({
          clientId: input.clientId,
          provider: input.provider,
          model: input.model,
          systemPrompt: providedSystemPrompt,
          title: generateSessionTitle(trimmedMessage)
        })
        sessionId = createdSession.id
      }

      if (!sessionId) {
        throw new AppError('无法创建会话', 500)
      }

      if (existingMessageCount === 0) {
        this.db
          .prepare(
            `
              UPDATE chat_sessions
              SET title = @title, updated_at = @updatedAt
              WHERE id = @id
            `
          )
          .run({
            id: sessionId,
            title: generateSessionTitle(trimmedMessage),
            updatedAt: timestamp
          })
      }

      const userMessageId = randomUUID()

      this.insertMessage({
        id: userMessageId,
        sessionId,
        role: 'user',
        content: trimmedMessage,
        status: 'done',
        errorMessage: null,
        timestamp
      })

      this.insertMessage({
        id: assistantMessageId,
        sessionId,
        role: 'assistant',
        content: '',
        status: 'streaming',
        errorMessage: null,
        timestamp
      })

      return {
        sessionId,
        assistantMessageId
      }
    })()

    const session = this.getSessionOrThrow(input.clientId, result.sessionId)
    const modelMessages = session.messages
      .filter((message) => message.id !== result.assistantMessageId)
      .filter((message) => message.content.trim().length > 0)
      .map((message) => ({
        role: message.role,
        content: message.content
      }))

    return {
      session,
      assistantMessageId: result.assistantMessageId,
      modelRequest: {
        provider: session.provider,
        model: session.model,
        systemPrompt: session.systemPrompt || undefined,
        messages: modelMessages
      }
    }
  }

  appendAssistantToken(assistantMessageId: string, token: string) {
    const timestamp = nowIso()

    const result = this.db.transaction(() => {
      const messageRow = this.findMessageRow(assistantMessageId)

      if (!messageRow) {
        throw new AppError('消息不存在', 404)
      }

      this.db
        .prepare(
          `
            UPDATE chat_messages
            SET content = content || @token,
                updated_at = @updatedAt
            WHERE id = @id
          `
        )
        .run({
          id: assistantMessageId,
          token,
          updatedAt: timestamp
        })

      this.touchSession(messageRow.session_id, timestamp)

      return {
        sessionId: messageRow.session_id
      }
    })()

    return result
  }

  completeAssistantMessage(assistantMessageId: string) {
    const timestamp = nowIso()

    const result = this.db.transaction(() => {
      const messageRow = this.findMessageRow(assistantMessageId)

      if (!messageRow) {
        throw new AppError('消息不存在', 404)
      }

      this.db
        .prepare(
          `
            UPDATE chat_messages
            SET status = 'done',
                error_message = NULL,
                updated_at = @updatedAt
            WHERE id = @id
          `
        )
        .run({
          id: assistantMessageId,
          updatedAt: timestamp
        })

      this.touchSession(messageRow.session_id, timestamp)

      return {
        sessionId: messageRow.session_id
      }
    })()

    return result
  }

  failAssistantMessage(assistantMessageId: string, errorMessage: string) {
    const timestamp = nowIso()

    const result = this.db.transaction(() => {
      const messageRow = this.findMessageRow(assistantMessageId)

      if (!messageRow) {
        throw new AppError('消息不存在', 404)
      }

      this.db
        .prepare(
          `
            UPDATE chat_messages
            SET status = 'error',
                error_message = @errorMessage,
                content = CASE
                  WHEN trim(content) = '' THEN @errorMessage
                  ELSE content
                END,
                updated_at = @updatedAt
            WHERE id = @id
          `
        )
        .run({
          id: assistantMessageId,
          errorMessage,
          updatedAt: timestamp
        })

      this.touchSession(messageRow.session_id, timestamp)

      return {
        sessionId: messageRow.session_id
      }
    })()

    return result
  }

  close() {
    this.db.close()
  }

  private hydrateSession(row: SessionRow): ChatSession {
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      provider: row.provider,
      model: row.model,
      systemPrompt: row.system_prompt,
      messages: this.listMessages(row.id)
    }
  }

  private listMessages(sessionId: string): ChatMessage[] {
    const messageRows = this.db
      .prepare(
        `
          SELECT id, session_id, role, content, status, error_message, created_at, updated_at
          FROM chat_messages
          WHERE session_id = ?
          ORDER BY created_at ASC
        `
      )
      .all(sessionId) as MessageRow[]

    return messageRows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
      errorMessage: row.error_message
    }))
  }

  private countMessages(sessionId: string) {
    const result = this.db
      .prepare(
        `
          SELECT COUNT(*) as count
          FROM chat_messages
          WHERE session_id = ?
        `
      )
      .get(sessionId) as { count: number }

    return result.count
  }

  private getSessionOrThrow(clientId: string, sessionId: string) {
    const row = this.findSessionRow(clientId, sessionId)

    if (!row) {
      throw new AppError('会话不存在', 404)
    }

    return this.hydrateSession(row)
  }

  private findSessionRow(clientId: string, sessionId: string) {
    return (
      (this.db
        .prepare(
          `
            SELECT id, client_id, title, provider, model, system_prompt, created_at, updated_at
            FROM chat_sessions
            WHERE id = ? AND client_id = ?
          `
        )
        .get(sessionId, clientId) as SessionRow | undefined) || null
    )
  }

  private findMessageRow(messageId: string) {
    return (
      (this.db
        .prepare(
          `
            SELECT id, session_id, role, content, status, error_message, created_at, updated_at
            FROM chat_messages
            WHERE id = ?
          `
        )
        .get(messageId) as MessageRow | undefined) || null
    )
  }

  private insertMessage(input: {
    id: string
    sessionId: string
    role: ChatMessage['role']
    content: string
    status: ChatMessage['status']
    errorMessage: string | null
    timestamp: string
  }) {
    this.db
      .prepare(
        `
          INSERT INTO chat_messages (
            id, session_id, role, content, status, error_message, created_at, updated_at
          ) VALUES (
            @id, @sessionId, @role, @content, @status, @errorMessage, @createdAt, @updatedAt
          )
        `
      )
      .run({
        id: input.id,
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        status: input.status,
        errorMessage: input.errorMessage,
        createdAt: input.timestamp,
        updatedAt: input.timestamp
      })
  }

  private touchSession(sessionId: string, updatedAt: string) {
    this.db
      .prepare(
        `
          UPDATE chat_sessions
          SET updated_at = ?
          WHERE id = ?
        `
      )
      .run(updatedAt, sessionId)
  }
}

const resolveDatabasePath = () => {
  const dbPath = process.env.CHAT_DB_PATH?.trim() || DEFAULT_DB_PATH

  if (dbPath === ':memory:') {
    return dbPath
  }

  return resolve(process.cwd(), dbPath)
}

const createDatabase = () => {
  const dbPath = resolveDatabasePath()

  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true })
  }

  return new Database(dbPath)
}

let repository: ChatRepository | null = null

export const getChatRepository = () => {
  if (!repository) {
    repository = new ChatRepository(createDatabase())
  }

  return repository
}

export const resetChatRepositoryForTests = () => {
  if (repository) {
    repository.close()
    repository = null
  }
}
