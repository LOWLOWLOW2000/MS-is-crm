import { describe, it, expect } from 'vitest'
import { compareByNextActAt } from './hold-list-config'

describe('compareByNextActAt', () => {
  it('sorts by next action time ascending', () => {
    const a = { nextActAt: '2026-03-30T10:00:00.000Z' }
    const b = { nextActAt: '2026-03-28T10:00:00.000Z' }
    expect(compareByNextActAt(a, b)).toBeGreaterThan(0)
    expect(compareByNextActAt(b, a)).toBeLessThan(0)
  })

  it('places missing nextActAt at the end', () => {
    const withTime = { nextActAt: '2026-03-28T10:00:00.000Z' }
    const missing = { nextActAt: null }
    expect(compareByNextActAt(withTime, missing)).toBeLessThan(0)
  })
})
