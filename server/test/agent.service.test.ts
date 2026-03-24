import { describe, expect, it, vi } from 'vitest'
import { runAgent } from '../src/modules/chat/agent.service.js'
import type {
  ChatProviderAdapter,
  ProviderChatCompletion,
  ProviderChatRequest,
  StreamHandlers
} from '../src/modules/chat/chat.types.js'

const createMockProvider = (
  completeChat: ChatProviderAdapter['completeChat']
): ChatProviderAdapter => ({
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

const completeResult = (partial?: Partial<ProviderChatCompletion>): ProviderChatCompletion => ({
  content: '',
  toolCalls: [],
  ...partial
})

describe('runAgent', () => {
  it('returns direct text when no tool is needed', async () => {
    const provider = createMockProvider(
      vi.fn(async () =>
        completeResult({
          content: '结果是 14。'
        })
      )
    )

    const result = await runAgent(provider, baseRequest)

    expect(result.mode).toBe('stream_text')
    expect(result.text).toBe('结果是 14。')
  })

  it('executes calculator tool and returns final model request', async () => {
    const provider = createMockProvider(
      vi.fn(async () =>
        completeResult({
          toolCalls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'calculator',
                arguments: JSON.stringify({
                  expression: '(2+3)*4'
                })
              }
            }
          ]
        })
      )
    )

    const result = await runAgent(provider, baseRequest)

    expect(result.mode).toBe('stream_model')
    expect(result.finalRequest?.tools).toBeUndefined()
    expect(result.finalRequest?.toolChoice).toBe('none')
    expect(result.finalRequest?.messages.at(-1)).toEqual({
      role: 'tool',
      toolCallId: 'call_1',
      content: '20'
    })
  })

  it('throws when tool arguments are not valid JSON', async () => {
    const provider = createMockProvider(
      vi.fn(async () =>
        completeResult({
          toolCalls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'calculator',
                arguments: '{bad-json}'
              }
            }
          ]
        })
      )
    )

    await expect(runAgent(provider, baseRequest)).rejects.toThrow(
      '工具 calculator 的 arguments 不是合法 JSON'
    )
  })

  it('throws when model requests an unregistered tool', async () => {
    const provider = createMockProvider(
      vi.fn(async () =>
        completeResult({
          toolCalls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'bad_tool',
                arguments: JSON.stringify({
                  foo: 'bar'
                })
              }
            }
          ]
        })
      )
    )

    await expect(runAgent(provider, baseRequest)).rejects.toThrow('模型请求了未注册的工具')
  })
})
