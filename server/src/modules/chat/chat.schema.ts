import { z } from 'zod'

export const chatRequestSchema = z.object({
  sessionId: z.string().uuid('会话 ID 格式不正确').optional(),
  provider: z.enum(['openai', 'deepseek']),
  model: z.string().min(1, '模型不能为空'),
  message: z.string().min(1, '消息内容不能为空'),
  systemPrompt: z.string().optional()
})

export const createSessionSchema = z.object({
  provider: z.enum(['openai', 'deepseek']),
  model: z.string().min(1, '模型不能为空'),
  systemPrompt: z.string().optional()
})

export type ParsedChatRequest = z.infer<typeof chatRequestSchema>
export type ParsedCreateSessionRequest = z.infer<typeof createSessionSchema>
