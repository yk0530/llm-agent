import { describe, expect, it } from 'vitest'
import { calculatorTool } from '../src/modules/chat/agent.tools.js'

describe('calculatorTool', () => {
  it('supports arithmetic with precedence and parentheses', () => {
    expect(calculatorTool.execute('(2 + 3) * 4')).toBe('20')
  })

  it('supports unary operators', () => {
    expect(calculatorTool.execute('-3 + 5')).toBe('2')
  })

  it('throws on invalid expressions', () => {
    expect(() => calculatorTool.execute('2 + abc')).toThrow('表达式包含不支持的字符')
  })
})
