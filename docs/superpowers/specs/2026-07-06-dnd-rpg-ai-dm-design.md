# Design: Text RPG (D&D-style) with AI Game Master

Date: 2026-07-06

## Overview

A single-page web application where a player creates a character through a
conversation with an AI agent, then plays a D&D-style text adventure against
an AI Dungeon Master (DM) powered by Google Gemini. No backend — everything
runs client-side, state persists in the browser.

## Goals (MVP scope)

- Settings screen for the user's own Gemini API key, with validation.
- Character creation via free-form chat with an AI agent, ending in a
  structured character object.
- Chat-style gameplay screen with a DM that narrates, requests dice rolls,
  and proposes state changes the player can accept, reject, or negotiate.
- Client-side dice rolling (no AI-generated randomness).
- Local session list: continue / delete / create new game.
- Basic, understandable error handling for API failures.

## Non-goals (explicitly out of scope for MVP)

- No backend/proxy — API calls go directly from the browser to Gemini.
- No XP/leveling system — character stats are fixed for the life of a game.
- No sharing a character across multiple games (1 character = 1 game).
- No multiplayer.
- No support for LLM providers other than Gemini (architecture should not
  actively prevent adding one later, but nothing is built for it now).

## Tech stack

- **React + Vite + TypeScript.** Standard, fast dev loop, no bundler
  configuration required, and TypeScript keeps the DM response protocol
  (see below) type-safe end to end.
- **IndexedDB** via the `idb` wrapper for persistence (game sessions,
  settings). Chosen over localStorage because game history + character data
  can grow large and benefit from structured, indexed storage.
- **Gemini SDK** (`@google/genai`) for direct browser calls, using
  `responseSchema` for structured JSON output (see Protocol section).
- No global state library needed for MVP — React context + component state
  is sufficient given the app has two real screens (create, play) plus a
  session list and settings.

## Repository

Standalone git repository at `DnDRPGAndroid/`, remote
`https://github.com/DeadLockUA/DnDRPGAndroid.git` — independent of the
`DeadLockUA_GitHub` monorepo that hosts unrelated projects.

## Data model (IndexedDB)

One record per game — a character is not reusable across games, so the two
are merged into a single entity:

```ts
interface GameSession {
  id: string
  characterName: string
  archetype: string
  backstory: string
  stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number } // 1-20
  hp: { current: number; max: number }
  inventory: Array<{ name: string; description: string; quantity: number }>
  messages: ChatMessage[]       // full recent history sent to the DM
  summary: string               // compacted older history (see Context strategy)
  createdAt: number
  lastPlayedAt: number
}

interface ChatMessage {
  role: 'dm' | 'player' | 'system'
  content: string
  timestamp: number
  diceResult?: { ability: string; roll: number; modifier: number; total: number; dc: number }
  stateUpdatesApplied?: boolean
}

interface Settings {
  apiKey: string
  language: 'ru' | 'en'
  geminiModel: string   // default 'gemini-2.5-flash'
}
```

Ability modifier: `floor((score - 10) / 2)`, standard D&D formula.

## Gemini integration & DM response protocol

Trade-off: Gemini's strict JSON mode (`responseSchema`) is reliable but
cannot be reliably combined with true token-level streaming, since the model
must produce a complete valid JSON object. **Decision: no real network
streaming.** The DM call is a single non-streaming request with
`responseSchema`; the UI shows a "DM is thinking..." indicator while waiting,
then reveals the `narration` text with a client-side typewriter effect for a
similar feel.

DM response schema:

```json
{
  "narration": "string",
  "dice_request": {
    "needed": "boolean",
    "ability": "str|dex|con|int|wis|cha|none",
    "dc": "number",
    "reason": "string"
  },
  "state_updates": [
    {
      "type": "hp_delta|inventory_add|inventory_remove|status_add|status_remove",
      "payload": "object",
      "reason": "string"
    }
  ]
}
```

The system prompt encodes: the character's current sheet, the simplified
D&D ability/modifier rules, crit-on-natural-20 / fumble-on-natural-1, and the
selected narration language.

### Turn flow

1. Player submits an action → sent to Gemini with recent history + character
   state → **Call A**.
2. If `dice_request.needed` is true: UI shows the situation text and a roll
   button labeled with the ability/DC. The roll (`d20 + ability modifier`)
   is computed client-side via `crypto.getRandomValues` — the AI never
   generates the number. The result is sent back as the next message →
   **Call B**, which returns `dice_request.needed = false` and (typically)
   `state_updates`.
3. Whenever a response includes non-empty `state_updates` (from Call A or
   B): the UI shows a diff of the proposed changes and three actions:
   - **Accept** — apply the changes (HP clamped to `[0, max]`), append the
     narration to the log, turn ends.
   - **Reject** — do not apply; send a system message asking the DM to
     propose a different narrative outcome for the *same* roll/action (the
     dice result itself is not re-rolled) → triggers a new DM call.
   - **Other** — player writes free text (e.g. "don't take my sword, do
     something else instead") → sent as a clarification → triggers a new DM
     call.
4. If a response has no `state_updates` and `dice_request.needed = false`,
   the narration is appended directly with no confirmation step.

### Context strategy

When a session's message history exceeds ~40 messages, everything except
the most recent ~10 is compacted via a single separate (non-streaming,
non-schema) Gemini call into a prose `summary`, stored on the `GameSession`
and substituted into the system prompt in place of the raw older messages.

## Character creation

A separate AI agent (same Gemini account/key, distinct system prompt) holds
a free-form chat: name → archetype/class → short backstory → ability scores
(agent proposes values fitting the archetype, player can request changes) →
starting inventory. When the agent judges the sheet complete, it proposes
starting the game; on player confirmation, one final non-streaming call with
a `Character` `responseSchema` converts the whole conversation into the
structured fields listed in the data model. The creation conversation itself
is not persisted into `GameSession.messages` — only the resulting sheet is.

## Settings screen

- API key field + "Test" button (lightweight Gemini call to validate).
- Language selector (`ru`/`en`), drives both UI strings and the DM's
  narration language via the system prompt.
- Gemini model selector, defaulting to `gemini-2.5-flash`.
- Explicit note that the key is stored only in the browser and never leaves
  it except in requests to Google's API.

## Session list (home screen)

Lists all `GameSession` records (character name, archetype, last played
date) with Continue / Delete actions, plus "New Game" → character creation
flow.

## Error handling

A single wrapper around all Gemini calls classifies failures: invalid key,
rate limit (429), network/offline, malformed/non-schema-conforming response
(retried once with a corrective instruction before surfacing an error), and
generic failures. Messages are localized through the same UI string
dictionary used for the rest of the interface.

## Project structure (proposed, to be finalized in the implementation plan)

```
DnDRPGAndroid/
  src/
    api/          # Gemini client, schemas, prompt builders, error mapping
    db/           # IndexedDB access (idb wrapper), models
    features/
      settings/
      character-creation/
      gameplay/     # chat UI, dice roll UI, accept/reject/other flow
      session-list/
    i18n/          # ru/en string dictionaries
    app/           # routing/shell
  docs/
    superpowers/specs/
```
