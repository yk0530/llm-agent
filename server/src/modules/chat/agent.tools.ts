import { AppError } from '../../errors.js'

type TokenType = 'number' | 'operator' | 'leftParen' | 'rightParen'

interface Token {
  type: TokenType
  value: string
}

class ExpressionParser {
  private index = 0

  constructor(private readonly tokens: Token[]) {}

  parse() {
    const result = this.parseExpression()

    if (this.hasNext()) {
      throw new AppError('表达式包含无法解析的内容', 400)
    }

    if (!Number.isFinite(result)) {
      throw new AppError('计算结果无效', 400)
    }

    return result
  }

  private parseExpression(): number {
    let value = this.parseTerm()

    while (true) {
      const token = this.peek()
      if (!token || token.type !== 'operator' || (token.value !== '+' && token.value !== '-')) {
        break
      }

      this.index += 1
      const right = this.parseTerm()
      value = token.value === '+' ? value + right : value - right
    }

    return value
  }

  private parseTerm(): number {
    let value = this.parseUnary()

    while (true) {
      const token = this.peek()
      if (!token || token.type !== 'operator' || (token.value !== '*' && token.value !== '/')) {
        break
      }

      this.index += 1
      const right = this.parseUnary()

      if (token.value === '/' && right === 0) {
        throw new AppError('除数不能为 0', 400)
      }

      value = token.value === '*' ? value * right : value / right
    }

    return value
  }

  private parseUnary(): number {
    const token = this.peek()

    if (token?.type === 'operator' && (token.value === '+' || token.value === '-')) {
      this.index += 1
      const value = this.parseUnary()
      return token.value === '-' ? -value : value
    }

    return this.parsePrimary()
  }

  private parsePrimary(): number {
    const token = this.peek()

    if (!token) {
      throw new AppError('表达式不完整', 400)
    }

    if (token.type === 'number') {
      this.index += 1
      return Number(token.value)
    }

    if (token.type === 'leftParen') {
      this.index += 1
      const value = this.parseExpression()
      const closing = this.peek()

      if (!closing || closing.type !== 'rightParen') {
        throw new AppError('括号未正确闭合', 400)
      }

      this.index += 1
      return value
    }

    throw new AppError(`无法解析 token: ${token.value}`, 400)
  }

  private peek() {
    return this.tokens[this.index]
  }

  private hasNext() {
    return this.index < this.tokens.length
  }
}

const tokenize = (expression: string) => {
  const tokens: Token[] = []
  let index = 0

  while (index < expression.length) {
    const char = expression[index]

    if (/\s/.test(char)) {
      index += 1
      continue
    }

    if (/[0-9.]/.test(char)) {
      let value = char
      index += 1

      while (index < expression.length && /[0-9.]/.test(expression[index])) {
        value += expression[index]
        index += 1
      }

      if (!/^\d+(\.\d+)?$|^\.\d+$/.test(value)) {
        throw new AppError(`无效数字: ${value}`, 400)
      }

      tokens.push({
        type: 'number',
        value: value.startsWith('.') ? `0${value}` : value
      })
      continue
    }

    if (char === '(') {
      tokens.push({ type: 'leftParen', value: char })
      index += 1
      continue
    }

    if (char === ')') {
      tokens.push({ type: 'rightParen', value: char })
      index += 1
      continue
    }

    if ('+-*/'.includes(char)) {
      tokens.push({ type: 'operator', value: char })
      index += 1
      continue
    }

    throw new AppError(`表达式包含不支持的字符: ${char}`, 400)
  }

  if (tokens.length === 0) {
    throw new AppError('表达式不能为空', 400)
  }

  return tokens
}

const normalizeNumber = (value: number) => {
  return Number.parseFloat(value.toPrecision(15)).toString()
}

export const calculatorTool = {
  name: 'calculator',
  description: '执行基础四则运算，支持 + - * / 和括号',
  execute: (expression: string) => {
    const trimmed = expression.trim()

    if (!trimmed) {
      throw new AppError('calculator 的 expression 不能为空', 400)
    }

    const tokens = tokenize(trimmed)
    const result = new ExpressionParser(tokens).parse()

    return normalizeNumber(result)
  }
}
