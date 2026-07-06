import { describe, it, expect } from 'vitest'
import { applyStateUpdates } from '../state-updates'
import type { GameSession, StateUpdate } from '../../../api/types'

function makeSession(): GameSession {
  return {
    id: 's1',
    characterName: 'Hero',
    archetype: 'Warrior',
    backstory: '',
    stats: { str: 14, dex: 12, con: 13, int: 10, wis: 11, cha: 9 },
    hp: { current: 10, max: 12 },
    inventory: [{ name: 'Potion', description: 'Heals', quantity: 2 }],
    statuses: [],
    messages: [],
    summary: '',
    createdAt: 0,
    lastPlayedAt: 0,
  }
}

describe('applyStateUpdates', () => {
  it('clamps HP to [0, max] on damage', () => {
    const s = makeSession()
    applyStateUpdates(s, [
      { type: 'hp_delta', payload: { amount: -100 }, reason: 'hit' },
    ] as StateUpdate[])
    expect(s.hp.current).toBe(0)
  })

  it('clamps healing to max', () => {
    const s = makeSession()
    applyStateUpdates(s, [
      { type: 'hp_delta', payload: { amount: 50 }, reason: 'heal' },
    ] as StateUpdate[])
    expect(s.hp.current).toBe(12)
  })

  it('merges quantity when adding an existing item', () => {
    const s = makeSession()
    applyStateUpdates(s, [
      {
        type: 'inventory_add',
        payload: { name: 'Potion', description: 'Heals', quantity: 3 },
        reason: 'found',
      },
    ] as StateUpdate[])
    expect(s.inventory.find((i) => i.name === 'Potion')?.quantity).toBe(5)
  })

  it('adds a new item', () => {
    const s = makeSession()
    applyStateUpdates(s, [
      {
        type: 'inventory_add',
        payload: { name: 'Sword', description: 'Sharp', quantity: 1 },
        reason: 'loot',
      },
    ] as StateUpdate[])
    expect(s.inventory).toHaveLength(2)
  })

  it('removes an item when quantity reaches zero', () => {
    const s = makeSession()
    applyStateUpdates(s, [
      {
        type: 'inventory_remove',
        payload: { name: 'Potion', quantity: 2 },
        reason: 'used',
      },
    ] as StateUpdate[])
    expect(s.inventory.find((i) => i.name === 'Potion')).toBeUndefined()
  })

  it('adds and removes status effects idempotently', () => {
    const s = makeSession()
    const add: StateUpdate[] = [
      {
        type: 'status_add',
        payload: { name: 'Poisoned', description: 'Losing HP' },
        reason: 'bite',
      },
      {
        type: 'status_add',
        payload: { name: 'Poisoned', description: 'dup' },
        reason: 'again',
      },
    ]
    applyStateUpdates(s, add)
    expect(s.statuses).toHaveLength(1)
    applyStateUpdates(s, [
      { type: 'status_remove', payload: { name: 'Poisoned' }, reason: 'cured' },
    ] as StateUpdate[])
    expect(s.statuses).toHaveLength(0)
  })
})
