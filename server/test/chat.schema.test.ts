import { describe, expect, it } from 'vitest'
import { chatRequestSchema, createSessionSchema } from '../src/modules/chat/chat.schema.js'

describe('chatRequestSchema', () => {
  it('accepts a valid request', () => {
    const parsed = chatRequestSchema.parse({
      provider: 'openai',
      model: 'gpt-4o-mini',
      message: 'hello'
    })

    expect(parsed.provider).toBe('openai')
    expect(parsed.message).toBe('hello')
  })

  it('rejects empty message', () => {
    const result = chatRequestSchema.safeParse({
      provider: 'openai',
      model: 'gpt-4o-mini',
      message: ''
    })

    expect(result.success).toBe(false)
  })
})

describe('createSessionSchema', () => {
  it('accepts a valid session creation request', () => {
    const parsed = createSessionSchema.parse({
      provider: 'deepseek',
      model: 'deepseek-chat'
    })

    expect(parsed.provider).toBe('deepseek')
  })
})
