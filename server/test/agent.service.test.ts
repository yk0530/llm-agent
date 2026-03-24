import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../src/errors.js'
import { runAgent } from '../src/modules/chat/agent.service.js'
import type { ChatProviderAdapter, ProviderChatRequest, StreamHandlers } from '../src/modules/chat/chat.types.js'

const createMockProvider = (completeChat: ChatProviderAdapter['completeChat']): ChatProviderAdapter => ({
  completeChat,
  streamChat: (_request: ProviderChatRequest, _handlers: StreamHandlers) => Promise.resolve()
})

const baseRequest: ProviderChatRequest = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  messages: [
    {
      role: 'user',
      content: '2 + 3 * 4 等于多少？'
    }
  ]
}

describe('runAgent', () => {
  it('returns direct response plan when no tool is needed', async () => {
    const provider = createMockProvider(
      vi.fn(async () => JSON.stringify({ type: 'respond_directly' }))
    )

    const result = await runAgent(provider, baseRequest)

    expect(result.finalRequest.systemPrompt).toContain('请直接回答用户')
    expect(result.finalRequest.systemPrompt).not.toContain('工具执行结果')
  })

  it('executes calculator tool and injects result into final prompt', async () => {
    const provider = createMockProvider(
      vi.fn(async () =>
        JSON.stringify({
          type: 'tool_call',
          tool: 'calculator',
          input: {
            expression: '(2+3)*4'
          }
        })
      )
    )

    const result = await runAgent(provider, baseRequest)

    expect(result.finalRequest.systemPrompt).toContain('工具：calculator')
    expect(result.finalRequest.systemPrompt).toContain('输出：20')
  })

  it('throws when model does not return valid JSON', async () => {
    const provider = createMockProvider(vi.fn(async () => 'not-json'))

    await expect(runAgent(provider, baseRequest)).rejects.toThrow(AppError)
    await expect(runAgent(provider, baseRequest)).rejects.toThrow('模型没有返回合法 JSON')
  })
})
