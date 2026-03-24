import type { Request, Response } from 'express'
import { AppError } from '../../errors.js'
import { runAgent } from './agent.service.js'
import { getChatRepository } from './chat.repository.js'
import { createSessionSchema, chatRequestSchema } from './chat.schema.js'
import { createProviderRegistry } from './provider-registry.js'
import {
  initSse,
  sendDoneEvent,
  sendErrorEvent,
  sendStartEvent,
  sendTokenEvent
} from './sse.js'

const requireClientId = (req: Request) => {
  const clientId = req.context.clientId?.trim()

  if (!clientId) {
    throw new AppError('缺少客户端标识，请刷新页面后重试', 400)
  }

  return clientId
}

export const listSessions = (req: Request, res: Response) => {
  const clientId = requireClientId(req)
  const repository = getChatRepository()

  res.json({
    sessions: repository.listSessions(clientId)
  })
}

export const createSession = (req: Request, res: Response) => {
  const clientId = requireClientId(req)
  const body = createSessionSchema.parse(req.body)
  const repository = getChatRepository()

  const session = repository.createSession({
    clientId,
    provider: body.provider,
    model: body.model,
    systemPrompt: body.systemPrompt
  })

  res.status(201).json(session)
}

export const deleteSession = (req: Request, res: Response) => {
  const clientId = requireClientId(req)
  const repository = getChatRepository()
  const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId

  repository.deleteSession(clientId, sessionId)
  res.status(204).send()
}

export const streamChat = async (req: Request, res: Response) => {
  const clientId = requireClientId(req)
  const body = chatRequestSchema.parse(req.body)
  const providers = createProviderRegistry()
  const provider = providers[body.provider]
  const repository = getChatRepository()
  const upstreamAbortController = new AbortController()
  let clientAborted = false

  let streamState:
    | {
        sessionId: string
        assistantMessageId: string
      }
    | undefined

  initSse(res)

  const abortUpstream = () => {
    if (res.writableEnded) {
      return
    }

    clientAborted = true
    upstreamAbortController.abort()
  }

  req.on('aborted', abortUpstream)
  res.on('close', abortUpstream)

  try {
    const started = repository.beginAssistantResponse({
      clientId,
      sessionId: body.sessionId,
      provider: body.provider,
      model: body.model,
      systemPrompt: body.systemPrompt,
      message: body.message
    })

    streamState = {
      sessionId: started.session.id,
      assistantMessageId: started.assistantMessageId
    }

    sendStartEvent(res, {
      requestId: req.context.requestId,
      session: started.session,
      assistantMessageId: started.assistantMessageId
    })

    const agentResult = await runAgent(provider, started.modelRequest, upstreamAbortController.signal)

    await provider.streamChat(
      agentResult.finalRequest,
      {
        onToken: (token) => {
          repository.appendAssistantToken(started.assistantMessageId, token)
          sendTokenEvent(res, {
            assistantMessageId: started.assistantMessageId,
            token
          })
        },
        onDone: () => {
          repository.completeAssistantMessage(started.assistantMessageId)
          sendDoneEvent(res, {
            requestId: req.context.requestId,
            sessionId: started.session.id,
            assistantMessageId: started.assistantMessageId
          })
        }
      },
      upstreamAbortController.signal
    )
  } catch (error) {
    const message = clientAborted ? '生成已手动停止' : error instanceof Error ? error.message : '流式请求失败'

    if (streamState?.assistantMessageId) {
      try {
        repository.failAssistantMessage(streamState.assistantMessageId, message)
      } catch (persistError) {
        console.error(persistError)
      }
    }

    if (!res.writableEnded && !clientAborted) {
      sendErrorEvent(res, {
        message,
        sessionId: streamState?.sessionId,
        assistantMessageId: streamState?.assistantMessageId
      })
    }
  } finally {
    if (!res.writableEnded) {
      res.end()
    }
  }
}
