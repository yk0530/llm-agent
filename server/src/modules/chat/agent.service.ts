import type { ChatProviderAdapter, ProviderChatRequest } from './chat.types.js'
import { executeTool, getToolNames, listToolDefinitions } from './tools/index.js'

const DIRECT_RESPONSE_PROMPT = `
请直接回答用户。
- 不要输出 JSON
- 不要解释你的内部工具决策
- 如果上文包含工具结果，请直接使用工具结果完成回答
`.trim()

export interface AgentExecutionResult {
  mode: 'stream_text' | 'stream_model'
  text?: string
  finalRequest?: ProviderChatRequest
}

const mergeSystemPrompts = (...parts: Array<string | undefined>) => {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join('\n\n')
}

export const runAgent = async (
  provider: ChatProviderAdapter,
  request: ProviderChatRequest,
  signal?: AbortSignal
): Promise<AgentExecutionResult> => {
  const toolDefinitions = listToolDefinitions()
  const completion = await provider.completeChat(
    {
      ...request,
      tools: toolDefinitions,
      toolChoice: toolDefinitions.length > 0 ? 'auto' : 'none'
    },
    signal
  )

  if (completion.toolCalls.length === 0) {
    return {
      mode: 'stream_text',
      text: completion.content
    }
  }

  const availableToolNames = new Set(getToolNames())
  const toolMessages = []

  for (const toolCall of completion.toolCalls) {
    if (!availableToolNames.has(toolCall.function.name)) {
      throw new Error(`模型请求了未注册的工具: ${toolCall.function.name}`)
    }

    let parsedArguments: unknown
    try {
      parsedArguments = JSON.parse(toolCall.function.arguments || '{}')
    } catch {
      throw new Error(`工具 ${toolCall.function.name} 的 arguments 不是合法 JSON`)
    }
    console.log('tool call args:', toolCall.function.name, toolCall.function.arguments)

    const execution = await executeTool(toolCall.function.name, parsedArguments)

    toolMessages.push({
      role: 'tool' as const,
      toolCallId: toolCall.id,
      content: execution.output
    })
  }

  return {
    mode: 'stream_model',
    finalRequest: {
      ...request,
      systemPrompt: mergeSystemPrompts(request.systemPrompt, DIRECT_RESPONSE_PROMPT),
      toolChoice: 'none',
      messages: [
        ...request.messages,
        {
          role: 'assistant',
          content: completion.content || '',
          toolCalls: completion.toolCalls
        },
        ...toolMessages
      ]
    }
  }
}
