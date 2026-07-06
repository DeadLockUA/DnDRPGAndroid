import { describe, it, expect } from 'vitest'
import { GeminiClient } from '../gemini-client'
import type { GameSession, ChatMessage, Settings } from '../types'

/**
 * LIVE integration test — hits the real Gemini API.
 * Opt-in only: runs when RUN_GEMINI_LIVE=1 AND GEMINI_LIVE_KEY is a real
 * AI Studio key (format AIza...). Gated behind a dedicated flag so a stray
 * GEMINI_API_KEY in the shell doesn't drag the normal offline suite online.
 *
 * PowerShell:
 *   $env:RUN_GEMINI_LIVE="1"; $env:GEMINI_LIVE_KEY="AIza..."; `
 *     npx vitest run src/api/__tests__/gemini.integration.test.ts
 * bash:
 *   RUN_GEMINI_LIVE=1 GEMINI_LIVE_KEY=AIza... \
 *     npx vitest run src/api/__tests__/gemini.integration.test.ts
 *
 * Optional: GEMINI_MODEL to override the model (default gemini-2.5-flash).
 */
const KEY = process.env.GEMINI_LIVE_KEY
const LIVE = process.env.RUN_GEMINI_LIVE === '1' && !!KEY
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

const settings: Settings = {
  apiKey: KEY ?? '',
  language: 'en',
  geminiModel: MODEL,
}

function makeSession(): GameSession {
  return {
    id: 'test',
    characterName: 'Thorn',
    archetype: 'Rogue',
    backstory: 'A nimble thief with a sharp tongue.',
    stats: { str: 10, dex: 16, con: 12, int: 13, wis: 11, cha: 14 },
    hp: { current: 12, max: 12 },
    inventory: [{ name: 'Dagger', description: 'A worn blade', quantity: 1 }],
    statuses: [],
    messages: [],
    summary: '',
    createdAt: 0,
    lastPlayedAt: 0,
  }
}

describe.skipIf(!LIVE)('Gemini live integration', () => {
  const client = new GeminiClient(settings)

  it('validates the API key', async () => {
    await client.validateApiKey()
  }, 30_000)

  it('produces a schema-valid opening DM turn', async () => {
    const session = makeSession()
    const kickoff: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Begin the adventure. Describe the opening scene and invite the first action.',
        timestamp: 0,
      },
    ]
    const resp = await client.generateDMTurn(session, kickoff, 'en')

    expect(typeof resp.narration).toBe('string')
    expect(resp.narration.length).toBeGreaterThan(0)
    expect(resp.dice_request).toBeDefined()
    expect(typeof resp.dice_request.needed).toBe('boolean')
    expect(Array.isArray(resp.state_updates)).toBe(true)

    console.log('\n--- OPENING NARRATION ---\n' + resp.narration + '\n')
  }, 45_000)

  it('requests a dice roll for a risky action and resolves it', async () => {
    const session = makeSession()
    const history: ChatMessage[] = [
      {
        role: 'dm',
        content:
          'You stand before a locked iron gate. A rusty lock holds it shut.',
        timestamp: 0,
      },
      {
        role: 'player',
        content: 'I try to pick the lock with my dagger.',
        timestamp: 1,
      },
    ]
    const resp = await client.generateDMTurn(session, history, 'en')
    expect(typeof resp.narration).toBe('string')
    // We don't force needed=true (the model decides), just log what it chose.
    console.log(
      '\n--- DICE REQUEST ---\n' + JSON.stringify(resp.dice_request, null, 2),
    )
    console.log(
      '--- STATE UPDATES ---\n' +
        JSON.stringify(resp.state_updates, null, 2) +
        '\n',
    )
  }, 45_000)

  it('extracts a structured character sheet from a creation chat', async () => {
    const chat: ChatMessage[] = [
      { role: 'dm', content: "Let's build your hero. What's your name?", timestamp: 0 },
      { role: 'player', content: 'Call me Mira.', timestamp: 1 },
      { role: 'dm', content: 'What class fits Mira?', timestamp: 2 },
      { role: 'player', content: 'A wizard, clever and frail.', timestamp: 3 },
      { role: 'dm', content: 'Give me a short backstory.', timestamp: 4 },
      {
        role: 'player',
        content: 'She fled a burning academy with a forbidden tome.',
        timestamp: 5,
      },
      {
        role: 'dm',
        content:
          'Proposed stats: STR 8, DEX 12, CON 10, INT 17, WIS 13, CHA 11. Starting gear: a tome, a dagger, robes. Ready?',
        timestamp: 6,
      },
      { role: 'player', content: 'Yes, that is perfect. Begin!', timestamp: 7 },
    ]
    const sheet = await client.extractCharacterSheet(chat, 'en')

    expect(sheet.characterName.toLowerCase()).toContain('mira')
    expect(sheet.stats.int).toBeGreaterThan(0)
    for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
      expect(sheet.stats[k]).toBeGreaterThanOrEqual(1)
      expect(sheet.stats[k]).toBeLessThanOrEqual(20)
    }
    expect(sheet.maxHp).toBeGreaterThan(0)
    expect(Array.isArray(sheet.inventory)).toBe(true)

    console.log('\n--- CHARACTER SHEET ---\n' + JSON.stringify(sheet, null, 2) + '\n')
  }, 45_000)
})
