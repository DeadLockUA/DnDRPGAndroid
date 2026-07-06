import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { initDB, getDB, _resetDBHandle } from '../index'
import { GAME_SESSIONS_STORE } from '../models'
import { getSettings, saveSettings } from '../settings'
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  getAllSessions,
  type NewSessionData,
} from '../game-session'
import { DEFAULT_SETTINGS } from '../models'
import type { ChatMessage } from '../../api/types'

function makeSessionData(name: string): NewSessionData {
  return {
    characterName: name,
    archetype: 'Ranger',
    backstory: 'A wanderer.',
    stats: { str: 16, dex: 14, con: 13, int: 12, wis: 15, cha: 11 },
    hp: { current: 10, max: 10 },
    inventory: [{ name: 'Sword', description: 'A blade', quantity: 1 }],
    statuses: [],
    messages: [],
    summary: '',
  }
}

beforeEach(async () => {
  // Fresh IndexedDB per test.
  _resetDBHandle()
  ;(globalThis as unknown as { indexedDB: IDBFactory }).indexedDB =
    new IDBFactory()
  await initDB()
})

describe('settings', () => {
  it('returns defaults before anything is saved', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('saves and retrieves settings without leaking the key field', async () => {
    await saveSettings({ apiKey: 'abc', language: 'ru', geminiModel: 'm' })
    const s = await getSettings()
    expect(s).toEqual({ apiKey: 'abc', language: 'ru', geminiModel: 'm' })
    expect((s as unknown as Record<string, unknown>).key).toBeUndefined()
  })
})

describe('game sessions', () => {
  it('creates a session with id and timestamps', async () => {
    const s = await createSession(makeSessionData('Aragorn'))
    expect(s.id).toBeTruthy()
    expect(s.createdAt).toBeGreaterThan(0)
    expect(s.lastPlayedAt).toBe(s.createdAt)
    expect(s.characterName).toBe('Aragorn')
  })

  it('retrieves a session by id', async () => {
    const created = await createSession(makeSessionData('Legolas'))
    expect(await getSession(created.id)).toEqual(created)
  })

  it('updates a session and appends messages', async () => {
    const s = await createSession(makeSessionData('Gimli'))
    s.hp.current = 6
    const msg: ChatMessage = {
      role: 'player',
      content: 'I attack',
      timestamp: 123,
    }
    s.messages.push(msg)
    await updateSession(s)
    const reloaded = await getSession(s.id)
    expect(reloaded?.hp.current).toBe(6)
    expect(reloaded?.messages).toHaveLength(1)
  })

  it('deletes a session', async () => {
    const s = await createSession(makeSessionData('Boromir'))
    await deleteSession(s.id)
    expect(await getSession(s.id)).toBeUndefined()
  })

  it('lists sessions most-recently-played first', async () => {
    const first = await createSession(makeSessionData('First'))
    const second = await createSession(makeSessionData('Second'))
    // Set distinct timestamps directly (updateSession re-stamps to now()).
    const db = await getDB()
    first.lastPlayedAt = 5000
    second.lastPlayedAt = 9000
    await db.put(GAME_SESSIONS_STORE, first)
    await db.put(GAME_SESSIONS_STORE, second)

    const all = await getAllSessions()
    expect(all).toHaveLength(2)
    expect(all[0].characterName).toBe('Second')
    expect(all[1].characterName).toBe('First')
  })
})
