import { beforeEach, describe, expect, it } from 'vitest'
import { loadState, saveState } from '../src/utils/storage'
import { DEFAULT_PERSISTED_STATE } from '../../shared/constants'

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns default state when storage is empty', () => {
    expect(loadState()).toEqual(DEFAULT_PERSISTED_STATE)
  })

  it('loads saved state', () => {
    const nextState = {
      ...DEFAULT_PERSISTED_STATE,
      activeSessionId: '1'
    }

    saveState(nextState)
    expect(loadState().activeSessionId).toBe('1')
  })
})
