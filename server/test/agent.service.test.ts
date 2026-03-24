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
      content: '帮我逐步计算这个问题'
    }
  ]
}

const completeResult = (partial?: Partial<ProviderChatCompletion>): ProviderChatCompletion => ({
  content: '',
  toolCalls: [],
  ...partial
})

describe('runAgent', () => {
  it('returns finalRequest even when no tool is needed', async () => {
    const provider = createMockProvider(
      vi.fn(async () =>
        completeResult({
          content: '结果是 14。'
        })
      )
    )

    const result = await runAgent(provider, baseRequest)

    expect(result.usedTools).toBe(false)
    expect(result.finalRequest.toolChoice).toBe('none')
    expect(result.finalRequest.messages).toEqual(baseRequest.messages)
  })

  it('executes one tool call and then returns the final streaming request', async () => {
    const completeChat = vi
      .fn<ChatProviderAdapter['completeChat']>()
      .mockResolvedValueOnce(
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
      .mockResolvedValueOnce(
        completeResult({
          content: '计算结果是 20。'
        })
      )

    const provider = createMockProvider(completeChat)
    const result = await runAgent(provider, baseRequest)

    expect(result.usedTools).toBe(true)
    expect(result.steps).toBe(2)
    expect(result.finalRequest.toolChoice).toBe('none')
    expect(result.finalRequest.messages.at(-1)).toEqual({
      role: 'tool',
      toolCallId: 'call_1',
      content: '20'
    })
  })

  it('supports multi-step tool loops before returning finalRequest', async () => {
    const completeChat = vi
      .fn<ChatProviderAdapter['completeChat']>()
      .mockResolvedValueOnce(
        completeResult({
          toolCalls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'calculator',
                arguments: JSON.stringify({
                  expression: '10+5'
                })
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        completeResult({
          toolCalls: [
            {
              id: 'call_2',
              type: 'function',
              function: {
                name: 'calculator',
                arguments: JSON.stringify({
                  expression: '15*2'
                })
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        completeResult({
          content: '最终结果是 30。'
        })
      )

    const provider = createMockProvider(completeChat)
    const result = await runAgent(provider, baseRequest)

    expect(result.usedTools).toBe(true)
    expect(result.steps).toBe(3)
    expect(result.finalRequest.messages.at(-1)).toEqual({
      role: 'tool',
      toolCallId: 'call_2',
      content: '30'
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
