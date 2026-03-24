import { AppError } from '../../../errors.js'
import { calculatorTool } from './calculator.js'
import type { ToolDefinition } from './types.js'

const toolRegistry = [calculatorTool] as const

type RegisteredTool = (typeof toolRegistry)[number]

const registryMap = new Map<string, RegisteredTool>(toolRegistry.map((tool) => [tool.name, tool]))

export const listTools = () => [...toolRegistry]

export const listToolDefinitions = () => listTools().map((tool) => tool.toolDefinition)

export const getTool = (toolName: string) => {
  const tool = registryMap.get(toolName)

  if (!tool) {
    throw new AppError(`未注册的工具: ${toolName}`, 400)
  }

  return tool
}

export const getToolNames = () => listTools().map((tool) => tool.name)

export const executeTool = async (toolName: string, input: unknown) => {
  const tool = getTool(toolName)
  const parsedInput = tool.inputSchema.safeParse(input)

  if (!parsedInput.success) {
    throw new AppError(`${toolName} 的输入不合法`, 400)
  }

  const output = await tool.execute(parsedInput.data)

  return {
    tool,
    parsedInput: parsedInput.data,
    output
  }
}

export type { ToolDefinition }
