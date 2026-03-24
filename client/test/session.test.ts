import { describe, expect, it } from 'vitest'
import { generateSessionTitle } from '../src/utils/session'

describe('generateSessionTitle', () => {
  it('returns fallback title for empty text', () => {
    expect(generateSessionTitle('   ')).toBe('新会话')
  })

  it('truncates long content', () => {
    expect(generateSessionTitle('abcdefghijklmnopqrstuvwxyz12345')).toBe('abcdefghijklmnopqrstuvwx...')
  })
})
