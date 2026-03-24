import { z } from 'zod'

export const calculatorToolInputSchema = z.object({
  expression: z.string().min(1, 'expression 不能为空')
})
