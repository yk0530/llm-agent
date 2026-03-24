import type { Response } from 'express'
import type {
  DoneStreamEvent,
  ErrorStreamEvent,
  StartStreamEvent,
  StreamEventName,
  TokenStreamEvent
} from '../../../../shared/types.js'

const writeEvent = (res: Response, event: StreamEventName, data: unknown) => {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

/**
 * 初始化服务器发送事件(SSE)连接
 * @param res - Express响应对象，用于设置SSE连接的相关头部信息
 */
export const initSse = (res: Response) => {
  res.status(200) // 设置HTTP状态码为200，表示请求成功
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8') // 设置内容类型为事件流，并指定字符编码为UTF-8
  res.setHeader('Cache-Control', 'no-cache, no-transform') // 禁用缓存，确保数据实时传输
  res.setHeader('Connection', 'keep-alive') // 保持连接活跃，以便持续发送事件
  res.flushHeaders() // 立即发送响应头，建立SSE连接
}

export const sendStartEvent = (res: Response, data: StartStreamEvent) => {
  writeEvent(res, 'start', data)
}

export const sendTokenEvent = (res: Response, data: TokenStreamEvent) => {
  writeEvent(res, 'token', data)
}

export const sendDoneEvent = (res: Response, data: DoneStreamEvent) => {
  writeEvent(res, 'done', data)
}

export const sendErrorEvent = (res: Response, data: ErrorStreamEvent) => {
  writeEvent(res, 'error', data)
}
