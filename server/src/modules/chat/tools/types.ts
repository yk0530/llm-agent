import type { z } from 'zod'
import type { FunctionToolDefinition } from '../chat.types.js'

export interface ToolDefinition<TInput extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string
  description: string
  inputSchema: TInput
  toolDefinition: FunctionToolDefinition
  execute: (input: z.infer<TInput>) => string | Promise<string>
}
