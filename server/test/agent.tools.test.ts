import { describe, expect, it } from 'vitest'
import { calculatorTool } from '../src/modules/chat/tools/calculator.js'

describe('calculatorTool', () => {
  it('supports arithmetic with precedence and parentheses', () => {
    expect(calculatorTool.execute({ expression: '(2 + 3) * 4' })).toBe('20')
  })

  it('supports unary operators', () => {
    expect(calculatorTool.execute({ expression: '-3 + 5' })).toBe('2')
  })

  it('throws on invalid expressions', () => {
    expect(() => calculatorTool.execute({ expression: '2 + abc' })).toThrow('表达式包含不支持的字符')
  })
})
