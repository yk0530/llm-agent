import { z } from 'zod'
import { AppError } from '../../errors.js'
import type { ChatProviderAdapter, ProviderChatRequest } from './chat.types.js'
import { calculatorTool } from './agent.tools.js'

const AGENT_DECISION_PROMPT = `
你是一个负责决定是否调用工具的 AI Agent。

你当前可用的工具只有一个：
- calculator: 执行基础四则运算，支持 + - * / 和括号

你的任务不是直接回答用户，而是先做决策，并且只能输出一段 JSON。

输出格式只能是以下两种之一：
1. 直接回答，不需要工具：
{"type":"respond_directly"}

2. 需要调用工具：
{"type":"tool_call","tool":"calculator","input":{"expression":"(12+3)*4"}}

规则：
- 只能输出合法 JSON，不要输出 Markdown，不要输出代码块，不要输出解释。
- 只有在用户明确要求计算、换算、比较可计算数值时，才调用 calculator。
- 如果问题不需要计算，返回 {"type":"respond_directly"}。
- expression 必须是可直接计算的数学表达式，不要包含单位、文字或变量。
`.trim()

const DIRECT_RESPONSE_PROMPT = `
请直接回答用户。
- 不要输出 JSON
- 不要解释你的内部工具决策
- 如果上文包含工具结果，请直接使用该结果给出自然语言回答
`.trim()

const agentDecisionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('respond_directly')
  }),
  z.object({
    type: z.literal('tool_call'),
    tool: z.literal('calculator'),
    input: z.object({
      expression: z.string().min(1, 'expression 不能为空')
    })
  })
])

interface AgentExecutionResult {
  finalRequest: ProviderChatRequest
}

const mergeSystemPrompts = (...parts: Array<string | undefined>) => {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join('\n\n')
}

const stripCodeFence = (raw: string) => {
  const trimmed = raw.trim()

  if (!trimmed.startsWith('```')) {
    return trimmed
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

const parseDecision = (raw: string) => {
  const candidate = stripCodeFence(raw)

  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch {
    throw new AppError(`模型没有返回合法 JSON: ${candidate}`, 500)
  }

  const result = agentDecisionSchema.safeParse(parsed)
  if (!result.success) {
    throw new AppError('模型返回的 JSON 不符合工具调用协议', 500)
  }

  return result.data
}

export const runAgent = async (
  provider: ChatProviderAdapter,
  request: ProviderChatRequest,
  signal?: AbortSignal
): Promise<AgentExecutionResult> => {
  const decisionRaw = await provider.completeChat(
    {
      ...request,
      systemPrompt: mergeSystemPrompts(request.systemPrompt, AGENT_DECISION_PROMPT),
      responseFormat: 'json_object'
    },
    signal
  )

  const decision = parseDecision(decisionRaw)

  if (decision.type === 'respond_directly') {
    return {
      finalRequest: {
        ...request,
        systemPrompt: mergeSystemPrompts(request.systemPrompt, DIRECT_RESPONSE_PROMPT)
      }
    }
  }

  const toolResult = calculatorTool.execute(decision.input.expression)

  return {
    finalRequest: {
      ...request,
      systemPrompt: mergeSystemPrompts(
        request.systemPrompt,
        `工具执行结果：
工具：calculator
输入：${decision.input.expression}
输出：${toolResult}`,
        DIRECT_RESPONSE_PROMPT
      )
    }
  }
}
