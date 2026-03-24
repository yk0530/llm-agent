import { describe, expect, it } from 'vitest'
import { executeTool, getTool, getToolNames, listToolDefinitions } from '../src/modules/chat/tools/index.js'

describe('tool registry', () => {
  it('exposes registered tools with underscore naming', () => {
    expect(getToolNames()).toContain('calculator')
    expect(getTool('calculator').name).toBe('calculator')
  })

  it('executes tools through the registry', async () => {
    const result = await executeTool('calculator', {
      expression: '(2 + 3) * 4'
    })

    expect(result.output).toBe('20')
  })

  it('exposes OpenAI-style tool definitions for models', () => {
    const definitions = listToolDefinitions()

    expect(definitions[0]).toEqual({
      type: 'function',
      function: {
        name: 'calculator',
        description: '当你需要进行数学表达式计算时非常有用。',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: '可直接计算的数学表达式，例如 (12+3)*4'
            }
          },
          required: ['expression'],
          additionalProperties: false
        },
        strict: true
      }
    })
  })
})
