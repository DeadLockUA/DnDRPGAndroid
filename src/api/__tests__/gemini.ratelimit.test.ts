import { describe, it, expect } from 'vitest'
import { GeminiClient } from '../gemini-client'
import { GeminiError, type Settings } from '../types'

/**
 * LIVE rate-limit test — INTENTIONALLY exhausts the free-tier quota to prove a
 * real 429 flows through classifyGeminiError → RATE_LIMIT and that
 * parseRetryAfterMs extracts a delay from the actual payload.
 *
 * Opt-in only (RUN_GEMINI_LIVE=1 + GEMINI_LIVE_KEY). Forces gemini-2.5-flash-lite
 * (low daily cap) so it trips quickly. This BURNS your daily quota for that model.
 *
 *   $env:RUN_GEMINI_LIVE="1"; npx vitest run src/api/__tests__/gemini.ratelimit.test.ts
 */
const KEY = process.env.GEMINI_LIVE_KEY
const LIVE = process.env.RUN_GEMINI_LIVE === '1' && !!KEY
const MAX_ATTEMPTS = 60

const settings: Settings = {
  apiKey: KEY ?? '',
  language: 'en',
  geminiModel: 'gemini-2.5-flash-lite',
}

describe.skipIf(!LIVE)('Gemini live rate-limit (burns free-tier quota)', () => {
  it('surfaces a real 429 as RATE_LIMIT', async () => {
    const client = new GeminiClient(settings)
    let caught: GeminiError | null = null
    let ok = 0

    for (let i = 0; i < MAX_ATTEMPTS && !caught; i++) {
      try {
        await client.validateApiKey()
        ok++
      } catch (e) {
        if (e instanceof GeminiError && e.code === 'RATE_LIMIT') {
          caught = e
        } else if (e instanceof GeminiError && e.code === 'INVALID_KEY') {
          throw e // bad key — fail fast, don't keep hammering
        }
        // NETWORK/UNKNOWN: keep trying
      }
    }

    console.log(`\n--- successful calls before 429: ${ok} ---`)
    expect(caught, `no 429 within ${MAX_ATTEMPTS} attempts`).not.toBeNull()
    expect(caught!.code).toBe('RATE_LIMIT')
    console.log('--- retryAfterMs:', caught!.retryAfterMs, '---')
    console.log('--- raw 429 (first 300 chars) ---\n' + caught!.message.slice(0, 300) + '\n')
  }, 180_000)
})
