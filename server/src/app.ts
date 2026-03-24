import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { errorHandler } from './middleware/error-handler.js'
import { attachRequestContext } from './middleware/request-context.js'
import { chatRouter } from './modules/chat/chat.routes.js'

/**
 * 创建并配置Express应用程序
 * @returns {Express.Application} 配置好的Express应用实例
 */
export const createApp = () => {
  // 创建Express应用实例
  const app = express()

  // 配置CORS中间件，设置允许的跨域请求来源
  app.use(
    cors({
      origin: env.corsOrigin  // 从环境变量中获取允许的源
    })
  )
  // 使用内置的JSON解析中间件，用于解析请求体中的JSON数据
  app.use(express.json())
  // 自定义中间件，用于附加请求上下文信息
  app.use(attachRequestContext)

  // 定义健康检查路由，用于服务状态监控
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,  // 服务状态正常
      service: 'ai-chat-server'  // 服务标识
    })
  })

  // 注册聊天相关的API路由
  app.use('/api/chat', chatRouter)
  // 注册错误处理中间件，用于捕获和处理应用中的错误
  app.use(errorHandler)

  // 返回配置完成的Express应用实例
  return app
}
