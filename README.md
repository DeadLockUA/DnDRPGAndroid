# D&D RPG — AI Dungeon Master

A single-page web app where you create a character by chatting with an AI, then
play a solo D&D-style text adventure against an AI Dungeon Master powered by
Google Gemini. Everything runs client-side; nothing leaves your browser except
requests to Google's API.

## Features

- **Bring your own key** — enter a Gemini API key in Settings (validated with a
  test call). Stored only in your browser (IndexedDB).
- **Character creation** — a free-form chat that walks you through name,
  archetype, backstory, ability scores, and starting inventory, then converts
  the conversation into a structured character sheet.
- **AI Dungeon Master** — narrates, calls for ability checks, and proposes
  changes to your HP / inventory / status effects that you can **Accept**,
  **Reject**, or negotiate (**Something else…**).
- **Honest dice** — every d20 is rolled client-side with the Web Crypto API;
  the AI never invents the number. Nat 20 always succeeds, nat 1 always fails.
- **Save & continue** — multiple games persist locally; long histories are
  auto-summarized to keep the context window manageable.
- **Bilingual** — English and Russian UI + narration.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173, go to **Settings**, and paste a Gemini API key
(get a free one at https://aistudio.google.com/apikey). Then **New Adventure**.

## Scripts

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Vite dev server                       |
| `npm run build`     | Type-check + production build         |
| `npm run preview`   | Serve the production build            |
| `npm run type-check`| `tsc --noEmit`                        |
| `npm test`          | Run the Vitest suite                  |

## Architecture

```
src/
  api/          Gemini client, DM/character schemas, prompt builders, error mapping
  db/           IndexedDB access (idb): settings + game sessions
  features/
    settings/           API key / language / model
    session-list/       home screen: continue / delete / new
    character-creation/ AI-guided character chat
    gameplay/           turn engine (useGameplay), dice, state updates, UI
  i18n/         en / ru dictionaries + helpers
  ui/           shared chat styles + typewriter hook
  app/          provider, routing shell
```

### DM turn protocol

Each DM reply is a single non-streaming Gemini call constrained by a
`responseSchema`:

```jsonc
{
  "narration": "…",
  "dice_request": { "needed": false, "ability": "none", "dc": 0, "reason": "" },
  "state_updates": [ { "type": "hp_delta", "payload": { "amount": -3 }, "reason": "…" } ]
}
```

- If `dice_request.needed`, the UI shows a roll button; the client rolls and
  sends the result back for a follow-up call that resolves the outcome.
- Non-empty `state_updates` are shown as a diff you confirm before they apply
  (HP is clamped to `[0, max]`).

## Tech stack

React 18 · Vite 6 · TypeScript · IndexedDB (`idb`) · `@google/genai` · Vitest
