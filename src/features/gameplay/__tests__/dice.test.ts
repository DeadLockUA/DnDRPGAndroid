import { describe, it, expect } from 'vitest'
import { rollD20, resolveRoll } from '../dice'
import type { Stats } from '../../../api/types'

const stats: Stats = { str: 16, dex: 8, con: 12, int: 10, wis: 14, cha: 11 }

describe('rollD20', () => {
  it('always yields 1-20', () => {
    for (let i = 0; i < 500; i++) {
      const r = rollD20()
      expect(r).toBeGreaterThanOrEqual(1)
      expect(r).toBeLessThanOrEqual(20)
    }
  })
})

describe('resolveRoll', () => {
  it('adds the ability modifier (STR 16 => +3)', () => {
    const r = resolveRoll('str', stats, 10, 12)
    expect(r.modifier).toBe(3)
    expect(r.total).toBe(15)
    expect(r.success).toBe(true)
  })

  it('applies negative modifiers (DEX 8 => -1)', () => {
    const r = resolveRoll('dex', stats, 10, 10)
    expect(r.modifier).toBe(-1)
    expect(r.total).toBe(9)
    expect(r.success).toBe(false)
  })

  it('uses no modifier for ability "none"', () => {
    const r = resolveRoll('none', stats, 5, 6)
    expect(r.modifier).toBe(0)
    expect(r.total).toBe(6)
  })

  it('nat 20 always succeeds even against an impossible DC', () => {
    const r = resolveRoll('dex', stats, 100, 20)
    expect(r.isNaturalTwenty).toBe(true)
    expect(r.success).toBe(true)
  })

  it('nat 1 always fails even with a big modifier', () => {
    const r = resolveRoll('str', stats, 2, 1)
    expect(r.isNaturalOne).toBe(true)
    expect(r.success).toBe(false)
  })
})
