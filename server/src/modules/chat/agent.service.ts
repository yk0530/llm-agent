import type { ChatProviderAdapter, ProviderChatMessage, ProviderChatRequest } from './chat.types.js'
import { executeTool, getToolNames, listToolDefinitions } from './tools/index.js'

const MAX_AGENT_STEPS = 8

const AGENT_LOOP_PROMPT = `
你是一个会使用工具的 AI Agent。
- 你可以进行多轮推理与多次工具调用。
- 当信息不足时，继续调用合适的工具。
- 当信息已经足够回答用户时，不要再调用工具，直接准备生成最终答案。
- 如果使用了工具，请基于工具结果回答，不要忽略工具输出。
`.trim()

const FINAL_RESPONSE_PROMPT = `
请直接回答用户。
- 不要输出 JSON
- 不要暴露内部推理过程
- 如果上文包含工具结果，请直接依据工具结果生成最终答案
`.trim()

export interface AgentExecutionResult {
  finalRequest: ProviderChatRequest
  steps: number
  usedTools: boolean
}

const mergeSystemPrompts = (...parts: Array<string | undefined>) => {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join('\n\n')
}

const createAssistantToolMessage = (
  content: string,
  toolCalls: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }>
): Extract<ProviderChatMessage, { role: 'assistant' }> => ({
  role: 'assistant',
  content,
  toolCalls
})

export const runAgent = async (
  provider: ChatProviderAdapter,
  request: ProviderChatRequest,
  signal?: AbortSignal
): Promise<AgentExecutionResult> => {
  const toolDefinitions = listToolDefinitions()
  const availableToolNames = new Set(getToolNames())
  const loopSystemPrompt = mergeSystemPrompts(request.systemPrompt, AGENT_LOOP_PROMPT)

  let workingMessages = [...request.messages]
  let steps = 0
  let usedTools = false

  for (; steps < MAX_AGENT_STEPS; steps += 1) {
    const completion = await provider.completeChat(
      {
        ...request,
        systemPrompt: loopSystemPrompt,
        messages: workingMessages,
        tools: toolDefinitions,
        toolChoice: toolDefinitions.length > 0 ? 'auto' : 'none'
      },
      signal
    )

    if (completion.toolCalls.length === 0) {
      return {
        steps: steps + 1,
        usedTools,
        finalRequest: {
          ...request,
          systemPrompt: mergeSystemPrompts(request.systemPrompt, FINAL_RESPONSE_PROMPT),
          toolChoice: 'none',
          messages: workingMessages
        }
      }
    }

    usedTools = true
    const toolMessages: ProviderChatMessage[] = []

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
        role: 'tool',
        toolCallId: toolCall.id,
        content: execution.output
      })
    }

    workingMessages = [
      ...workingMessages,
      createAssistantToolMessage(completion.content || '', completion.toolCalls),
      ...toolMessages
    ]
  }

  throw new Error(`Agent 超过最大工具调用轮数限制（${MAX_AGENT_STEPS}）`)
}
