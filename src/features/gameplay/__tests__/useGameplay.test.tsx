import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'

// Controllable fake Gemini client, injected via a mocked useApp.
const { gemini } = vi.hoisted(() => ({
  gemini: {
    generateDMTurn: vi.fn(),
    summarize: vi.fn(),
    generateCreationReply: vi.fn(),
    extractCharacterSheet: vi.fn(),
    validateApiKey: vi.fn(),
    updateSettings: vi.fn(),
  },
}))

vi.mock('../../../app/AppContext', () => ({
  useApp: () => ({ gemini, language: 'en' }),
}))

import { useGameplay } from '../useGameplay'
import { _resetDBHandle, initDB } from '../../../db'
import {
  createSession,
  getSession,
  type NewSessionData,
} from '../../../db/game-session'
import type { DMResponse, StateUpdate, ChatMessage } from '../../../api/types'
import { GeminiError } from '../../../api/types'

type SeedData = NewSessionData

function plain(narration = 'Nothing happens.'): DMResponse {
  return {
    narration,
    dice_request: { needed: false, ability: 'none', dc: 0, reason: '' },
    state_updates: [],
  }
}

function needsRoll(): DMResponse {
  return {
    narration: 'Make a check.',
    dice_request: { needed: true, ability: 'dex', dc: 10, reason: 'lockpick' },
    state_updates: [],
  }
}

function withUpdates(updates: StateUpdate[], narration = 'It resolves.'): DMResponse {
  return {
    narration,
    dice_request: { needed: false, ability: 'none', dc: 0, reason: '' },
    state_updates: updates,
  }
}

// Session pre-seeded with one DM message so the hook starts idle (no opening call).
function seed(overrides: Partial<SeedData> = {}): SeedData {
  const base: NewSessionData = {
    characterName: 'Thorn',
    archetype: 'Rogue',
    backstory: 'Sneaky.',
    stats: { str: 10, dex: 16, con: 12, int: 13, wis: 11, cha: 14 },
    hp: { current: 10, max: 10 },
    inventory: [{ name: 'Sword', description: 'Sharp', quantity: 1 }],
    statuses: [],
    enemies: [],
    messages: [{ role: 'dm', content: 'The tale begins.', timestamp: 0 }],
    summary: '',
  }
  return { ...base, ...overrides }
}

beforeEach(async () => {
  vi.clearAllMocks()
  _resetDBHandle()
  ;(globalThis as unknown as { indexedDB: IDBFactory }).indexedDB =
    new IDBFactory()
  await initDB()
})

async function mountFor(sessionId: string) {
  const view = renderHook(() => useGameplay(sessionId))
  await waitFor(() => expect(view.result.current.phase).toBe('idle'))
  return view
}

describe('useGameplay — dice → auto-applied updates', () => {
  it('rolls, then auto-applies and persists HP damage', async () => {
    gemini.generateDMTurn
      .mockResolvedValueOnce(needsRoll())
      .mockResolvedValueOnce(
        withUpdates([{ type: 'hp_delta', payload: { amount: -3 }, reason: 'hit' }]),
      )

    const s = await createSession(seed())
    const { result } = await mountFor(s.id)

    await act(async () => {
      await result.current.submitAction('I pick the lock')
    })
    expect(result.current.phase).toBe('awaitingRoll')
    expect(result.current.pendingRoll?.ability).toBe('dex')

    await act(async () => {
      await result.current.roll()
    })
    // No confirmation step — updates apply immediately.
    expect(result.current.phase).toBe('idle')
    expect(result.current.session?.hp.current).toBe(7)

    // Persisted to IndexedDB.
    const reloaded = await getSession(s.id)
    expect(reloaded?.hp.current).toBe(7)
    // Dice result was recorded as a system message.
    expect(
      reloaded?.messages.some((m: ChatMessage) => m.diceResult?.ability === 'dex'),
    ).toBe(true)
  })

  it('auto-applies enemy damage from a successful hit without touching the player', async () => {
    gemini.generateDMTurn.mockResolvedValueOnce(
      withUpdates([
        { type: 'enemy_add', payload: { name: 'Bandit', maxHp: 10 }, reason: 'spawn' },
        { type: 'enemy_hp_delta', payload: { name: 'Bandit', amount: -4 }, reason: 'stab' },
      ]),
    )
    const s = await createSession(seed())
    const { result } = await mountFor(s.id)

    await act(async () => {
      await result.current.submitAction('I stab the bandit')
    })
    expect(result.current.phase).toBe('idle')
    expect(result.current.session?.enemies).toHaveLength(1)
    expect(result.current.session?.enemies[0].hp.current).toBe(6)
    expect(result.current.session?.hp.current).toBe(10) // player untouched
  })

  it('lets the player act instead of rolling, discarding the pending roll', async () => {
    gemini.generateDMTurn
      .mockResolvedValueOnce(needsRoll())
      .mockResolvedValueOnce(plain('You do something else entirely.'))
    const s = await createSession(seed())
    const { result } = await mountFor(s.id)

    await act(async () => {
      await result.current.submitAction('I pick the lock')
    })
    expect(result.current.phase).toBe('awaitingRoll')

    // Instead of rolling, the player declares a different action.
    await act(async () => {
      await result.current.submitAction('Actually I kick the door down')
    })
    expect(result.current.phase).toBe('idle')
    expect(result.current.pendingRoll).toBeNull()
    expect(gemini.generateDMTurn).toHaveBeenCalledTimes(2)
  })

  it('goes to defeated when auto-applied damage drops HP to 0', async () => {
    gemini.generateDMTurn.mockResolvedValueOnce(
      withUpdates([{ type: 'hp_delta', payload: { amount: -50 }, reason: 'crush' }]),
    )
    const s = await createSession(seed({ hp: { current: 10, max: 10 } }))
    const { result } = await mountFor(s.id)

    await act(async () => {
      await result.current.submitAction('I taunt the dragon')
    })
    expect(result.current.phase).toBe('defeated')
    expect(result.current.session?.hp.current).toBe(0)
  })
})

describe('useGameplay — opening scene', () => {
  it('never offers a roll on the opening turn, even if the DM asks', async () => {
    // Empty message history → the hook fires an opening (kickoff) turn.
    gemini.generateDMTurn.mockResolvedValueOnce(needsRoll())
    const s = await createSession(seed({ messages: [] }))
    const { result } = renderHook(() => useGameplay(s.id))

    await waitFor(() => expect(result.current.phase).toBe('idle'))
    expect(result.current.pendingRoll).toBeNull()
    // The narration is still shown.
    expect(
      result.current.session?.messages.some((m) => m.role === 'dm'),
    ).toBe(true)
  })
})

describe('useGameplay — rate-limit retry', () => {
  it('surfaces RATE_LIMIT + retryAfterMs, then retry replays the turn', async () => {
    gemini.generateDMTurn
      .mockRejectedValueOnce(new GeminiError('RATE_LIMIT', '429 quota', 5000))
      .mockResolvedValueOnce(plain('The story continues.'))

    const s = await createSession(seed())
    const { result } = await mountFor(s.id)

    await act(async () => {
      await result.current.submitAction('I look around')
    })
    expect(result.current.phase).toBe('idle')
    expect(result.current.error).toBe('RATE_LIMIT')
    expect(result.current.retryAfterMs).toBe(5000)

    await act(async () => {
      result.current.retry()
    })
    await waitFor(() => expect(result.current.error).toBeNull())
    expect(gemini.generateDMTurn).toHaveBeenCalledTimes(2)
    expect(
      result.current.session?.messages.some(
        (m) => m.role === 'dm' && m.content === 'The story continues.',
      ),
    ).toBe(true)
  })
})

describe('useGameplay — context summarization', () => {
  it('compacts old history into a summary once past 40 messages', async () => {
    gemini.summarize.mockResolvedValue('A tidy recap.')
    gemini.generateDMTurn.mockResolvedValueOnce(plain())

    // 49 messages seeded; the player's action makes 50 → triggers summarize.
    const many: ChatMessage[] = Array.from({ length: 49 }, (_, i) => ({
      role: i % 2 === 0 ? 'dm' : 'player',
      content: `line ${i}`,
      timestamp: i,
    }))
    const s = await createSession(seed({ messages: many }))
    const { result } = await mountFor(s.id)

    await act(async () => {
      await result.current.submitAction('the 50th message')
    })

    expect(gemini.summarize).toHaveBeenCalledTimes(1)
    // Summarized everything except the most recent 10.
    const transcriptArg = gemini.summarize.mock.calls[0][0] as string
    expect(transcriptArg).toContain('line 0')
    expect(result.current.session?.summary).toBe('A tidy recap.')
  })

  it('does not summarize below the threshold', async () => {
    gemini.generateDMTurn.mockResolvedValueOnce(plain())
    const s = await createSession(seed())
    const { result } = await mountFor(s.id)

    await act(async () => {
      await result.current.submitAction('just one action')
    })
    expect(gemini.summarize).not.toHaveBeenCalled()
  })
})
