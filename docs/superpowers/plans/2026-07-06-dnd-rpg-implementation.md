# D&D RPG with AI DM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page React web app where a player creates a D&D character via AI conversation, then plays a text adventure against an AI Dungeon Master with client-side dice rolls and local session persistence.

**Architecture:** 
- **Settings & Auth:** API key validation, language/model selection stored in IndexedDB
- **Session management:** Game sessions persisted as IndexedDB records, each session is a character + game history
- **Character creation:** Multi-turn Gemini conversation with structured JSON output schema
- **Gameplay:** Turn-based chat with DM, structured API responses (narration + dice requests + state updates), client-side dice rolling, UI confirmation for state changes
- **Presentation:** Typewriter effect on narration, diff UI for proposed state changes

**Tech Stack:** React 18 + Vite + TypeScript, IndexedDB (idb), Google Gemini SDK, client-side crypto randomness

---

## Global Constraints

- **Runtime:** Client-side only; no backend/proxy. API calls go directly from browser to Gemini.
- **Persistence:** All data (settings, game sessions, chat history) lives in IndexedDB.
- **API:** Google Gemini SDK (`@google/genai`); responseSchema for structured output.
- **Languages:** English (en) and Russian (ru); narration language is player-selectable.
- **Dice:** Client-side only via `crypto.getRandomValues()`; AI never generates random numbers.
- **No streaming:** Gemini calls are non-streaming due to responseSchema + JSON mode incompatibility.
- **Database:** No XP/leveling; character stats are immutable per game.
- **Character uniqueness:** One character per game; no character reuse across games.

---

## Phase 1: Foundation & Infrastructure

### Task 1: Project Initialization & Dependencies

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: Vite dev server ready to run, all dependencies installed, TypeScript configured

- [ ] **Step 1: Add npm dependencies**

Install core dependencies:
```bash
npm install react react-dom
npm install --save-dev @types/react @types/react-dom typescript
npm install --save-dev @vitejs/plugin-react
npm install idb
npm install @google/generative-ai
```

- [ ] **Step 2: Create Vite config**

Create `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
})
```

- [ ] **Step 3: Configure TypeScript**

Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassMembers": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "resolveJsonModule": true,
    "moduleResolution": "bundler",
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.app.json" }]
}
```

Create `tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler"
  },
  "include": ["vite.env.d.ts"]
}
```

- [ ] **Step 4: Create entry files**

Create `src/main.tsx`:
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

Create `index.html` in project root:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>D&D RPG with AI DM</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Add npm scripts and verify build**

Update `package.json` scripts section:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit"
  }
}
```

- [ ] **Step 6: Test dev server**

```bash
npm install
npm run dev
```

Expected: Vite dev server starts on http://localhost:5173

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig*.json src/main.tsx index.html src/index.css
git commit -m "chore: initialize Vite + React + TypeScript project"
```

---

### Task 2: TypeScript Interfaces & Data Models

**Files:**
- Create: `src/api/types.ts`
- Create: `src/db/models.ts`

**Interfaces:**
- Produces: TypeScript interfaces for `GameSession`, `ChatMessage`, `Settings`, `DMResponse`, `Character`, `DiceResult`

- [ ] **Step 1: Create API types**

Create `src/api/types.ts`:
```typescript
export interface DiceResult {
  ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' | 'none'
  roll: number // 1-20
  modifier: number
  total: number
  dc: number
  isNaturalTwenty: boolean
  isNaturalOne: boolean
}

export interface DiceRequest {
  needed: boolean
  ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha' | 'none'
  dc: number
  reason: string
}

export type StateUpdateType =
  | 'hp_delta'
  | 'inventory_add'
  | 'inventory_remove'
  | 'status_add'
  | 'status_remove'

export interface StateUpdate {
  type: StateUpdateType
  payload: Record<string, unknown>
  reason: string
}

export interface DMResponse {
  narration: string
  dice_request: DiceRequest
  state_updates: StateUpdate[]
}

export interface ChatMessage {
  role: 'dm' | 'player' | 'system'
  content: string
  timestamp: number
  diceResult?: DiceResult
  stateUpdatesApplied?: boolean
}

export interface InventoryItem {
  name: string
  description: string
  quantity: number
}

export interface Character {
  characterName: string
  archetype: string
  backstory: string
  stats: {
    str: number
    dex: number
    con: number
    int: number
    wis: number
    cha: number
  }
}

export interface GameSession {
  id: string
  characterName: string
  archetype: string
  backstory: string
  stats: {
    str: number
    dex: number
    con: number
    int: number
    wis: number
    cha: number
  }
  hp: { current: number; max: number }
  inventory: InventoryItem[]
  messages: ChatMessage[]
  summary: string
  createdAt: number
  lastPlayedAt: number
}

export interface Settings {
  apiKey: string
  language: 'ru' | 'en'
  geminiModel: string
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | 'MALFORMED_RESPONSE' | 'UNKNOWN'
  ) {
    super(message)
    this.name = 'GeminiError'
  }
}
```

- [ ] **Step 2: Create database models**

Create `src/db/models.ts`:
```typescript
import { GameSession, Settings } from '../api/types'

export const DB_NAME = 'DnDRPG'
export const GAME_SESSIONS_STORE = 'gameSessions'
export const SETTINGS_STORE = 'settings'

export interface DBGameSession extends GameSession {}
export interface DBSettings extends Settings {}

export const DEFAULT_SETTINGS: DBSettings = {
  apiKey: '',
  language: 'en',
  geminiModel: 'gemini-2.5-flash',
}

export function calculateAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2)}`
}
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npm run type-check
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/api/types.ts src/db/models.ts
git commit -m "feat: define TypeScript interfaces for game state and API responses"
```

---

## Phase 2: Database Layer

### Task 3: IndexedDB Initialization & Settings CRUD

**Files:**
- Create: `src/db/index.ts`
- Create: `src/db/settings.ts`
- Create: `src/db/__tests__/settings.test.ts`

**Interfaces:**
- Consumes: Types from `src/db/models.ts`
- Produces: `initDB()`, `getSettings()`, `saveSettings()`

- [ ] **Step 1: Write database initialization test**

Create `src/db/__tests__/settings.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initDB, getSettings, saveSettings } from '../settings'
import { DEFAULT_SETTINGS } from '../models'

describe('IndexedDB Settings', () => {
  beforeEach(async () => {
    // Clear IndexedDB before each test
    const dbs = await (indexedDB as any).databases()
    dbs.forEach((db: any) => {
      if (db.name === 'DnDRPG') {
        indexedDB.deleteDatabase('DnDRPG')
      }
    })
    await initDB()
  })

  afterEach(() => {
    indexedDB.deleteDatabase('DnDRPG')
  })

  it('should initialize database', async () => {
    const db = await initDB()
    expect(db).toBeDefined()
    expect(db.objectStoreNames.contains('settings')).toBe(true)
    expect(db.objectStoreNames.contains('gameSessions')).toBe(true)
  })

  it('should save and retrieve settings', async () => {
    await initDB()
    const newSettings = {
      apiKey: 'test-key-123',
      language: 'en' as const,
      geminiModel: 'gemini-2.5-flash',
    }
    
    await saveSettings(newSettings)
    const retrieved = await getSettings()
    
    expect(retrieved.apiKey).toBe('test-key-123')
    expect(retrieved.language).toBe('en')
  })

  it('should return default settings on first access', async () => {
    await initDB()
    const settings = await getSettings()
    expect(settings).toEqual(DEFAULT_SETTINGS)
  })
})
```

- [ ] **Step 2: Implement database initialization**

Create `src/db/index.ts`:
```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { DB_NAME, GAME_SESSIONS_STORE, SETTINGS_STORE } from './models'
import type { GameSession, Settings } from '../api/types'

interface DnDRPGDB extends DBSchema {
  [GAME_SESSIONS_STORE]: {
    key: string
    value: GameSession
    indexes: { 'by-last-played': number }
  }
  [SETTINGS_STORE]: {
    key: string
    value: Settings
  }
}

let dbInstance: IDBPDatabase<DnDRPGDB> | null = null

export async function initDB(): Promise<IDBPDatabase<DnDRPGDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<DnDRPGDB>(DB_NAME, 1, {
    upgrade(db) {
      // Create game sessions store
      if (!db.objectStoreNames.contains(GAME_SESSIONS_STORE)) {
        const sessionStore = db.createObjectStore(GAME_SESSIONS_STORE, {
          keyPath: 'id',
        })
        sessionStore.createIndex('by-last-played', 'lastPlayedAt')
      }

      // Create settings store
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
      }
    },
  })

  return dbInstance
}

export async function getDB(): Promise<IDBPDatabase<DnDRPGDB>> {
  if (!dbInstance) {
    await initDB()
  }
  return dbInstance!
}
```

- [ ] **Step 3: Implement settings CRUD**

Create `src/db/settings.ts`:
```typescript
import { getDB } from './index'
import { SETTINGS_STORE, DEFAULT_SETTINGS } from './models'
import type { Settings } from '../api/types'

const SETTINGS_KEY = 'user_settings'

export async function getSettings(): Promise<Settings> {
  const db = await getDB()
  const settings = await db.get(SETTINGS_STORE, SETTINGS_KEY)
  return settings || DEFAULT_SETTINGS
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDB()
  await db.put(SETTINGS_STORE, { ...settings, key: SETTINGS_KEY })
}

export async function resetSettings(): Promise<void> {
  const db = await getDB()
  await db.delete(SETTINGS_STORE, SETTINGS_KEY)
}
```

- [ ] **Step 4: Setup Vitest for testing**

Add to `package.json` devDependencies:
```bash
npm install --save-dev vitest @vitest/ui jsdom
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
```

Update `package.json` scripts:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- src/db/__tests__/settings.test.ts
```

Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/db/index.ts src/db/settings.ts src/db/__tests__/settings.test.ts vitest.config.ts package.json
git commit -m "feat: add IndexedDB layer with settings CRUD and tests"
```

---

### Task 4: Game Session CRUD

**Files:**
- Create: `src/db/game-session.ts`
- Create: `src/db/__tests__/game-session.test.ts`

**Interfaces:**
- Consumes: `initDB()` from `src/db/index.ts`, types from `src/db/models.ts`
- Produces: `createSession()`, `getSession()`, `updateSession()`, `deleteSession()`, `getAllSessions()`

- [ ] **Step 1: Write game session tests**

Create `src/db/__tests__/game-session.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initDB } from '../index'
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  getAllSessions,
} from '../game-session'
import type { GameSession, ChatMessage } from '../../api/types'

describe('Game Session CRUD', () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase('DnDRPG')
    await initDB()
  })

  afterEach(() => {
    indexedDB.deleteDatabase('DnDRPG')
  })

  it('should create a new game session', async () => {
    const sessionData = {
      characterName: 'Aragorn',
      archetype: 'Ranger',
      backstory: 'A wanderer of the wild',
      stats: { str: 16, dex: 14, con: 13, int: 12, wis: 15, cha: 11 },
      hp: { current: 10, max: 10 },
      inventory: [{ name: 'Sword', description: 'A long sword', quantity: 1 }],
      messages: [] as ChatMessage[],
      summary: '',
    }

    const session = await createSession(sessionData)

    expect(session.id).toBeDefined()
    expect(session.characterName).toBe('Aragorn')
    expect(session.createdAt).toBeDefined()
    expect(session.lastPlayedAt).toBeDefined()
  })

  it('should retrieve a session by ID', async () => {
    const sessionData = {
      characterName: 'Legolas',
      archetype: 'Archer',
      backstory: 'An elf prince',
      stats: { str: 12, dex: 18, con: 13, int: 11, wis: 14, cha: 13 },
      hp: { current: 8, max: 8 },
      inventory: [],
      messages: [],
      summary: '',
    }

    const created = await createSession(sessionData)
    const retrieved = await getSession(created.id)

    expect(retrieved).toEqual(created)
  })

  it('should update a session', async () => {
    const sessionData = {
      characterName: 'Gimli',
      archetype: 'Dwarf',
      backstory: 'A dwarf warrior',
      stats: { str: 17, dex: 10, con: 16, int: 12, wis: 13, cha: 10 },
      hp: { current: 12, max: 12 },
      inventory: [{ name: 'Axe', description: 'A battle axe', quantity: 1 }],
      messages: [],
      summary: '',
    }

    const session = await createSession(sessionData)
    session.hp.current = 6
    const message: ChatMessage = {
      role: 'player',
      content: 'I attack the goblin',
      timestamp: Date.now(),
    }
    session.messages.push(message)

    const updated = await updateSession(session)

    expect(updated.hp.current).toBe(6)
    expect(updated.messages).toHaveLength(1)
  })

  it('should delete a session', async () => {
    const sessionData = {
      characterName: 'Boromir',
      archetype: 'Knight',
      backstory: 'A noble warrior',
      stats: { str: 16, dex: 13, con: 15, int: 13, wis: 11, cha: 14 },
      hp: { current: 13, max: 13 },
      inventory: [],
      messages: [],
      summary: '',
    }

    const session = await createSession(sessionData)
    await deleteSession(session.id)

    const retrieved = await getSession(session.id)
    expect(retrieved).toBeUndefined()
  })

  it('should retrieve all sessions sorted by last played', async () => {
    const session1 = await createSession({
      characterName: 'Character 1',
      archetype: 'Archer',
      backstory: 'First char',
      stats: { str: 12, dex: 14, con: 13, int: 12, wis: 13, cha: 12 },
      hp: { current: 8, max: 8 },
      inventory: [],
      messages: [],
      summary: '',
    })

    await new Promise((r) => setTimeout(r, 10))

    const session2 = await createSession({
      characterName: 'Character 2',
      archetype: 'Warrior',
      backstory: 'Second char',
      stats: { str: 15, dex: 12, con: 14, int: 11, wis: 12, cha: 13 },
      hp: { current: 10, max: 10 },
      inventory: [],
      messages: [],
      summary: '',
    })

    const allSessions = await getAllSessions()

    expect(allSessions).toHaveLength(2)
    expect(allSessions[0].id).toBe(session2.id) // Most recent first
    expect(allSessions[1].id).toBe(session1.id)
  })
})
```

- [ ] **Step 2: Implement game session CRUD**

Create `src/db/game-session.ts`:
```typescript
import { getDB } from './index'
import { GAME_SESSIONS_STORE, generateSessionId } from './models'
import type { GameSession } from '../api/types'

export async function createSession(
  data: Omit<GameSession, 'id' | 'createdAt' | 'lastPlayedAt'>
): Promise<GameSession> {
  const db = await getDB()
  const now = Date.now()

  const session: GameSession = {
    id: generateSessionId(),
    ...data,
    createdAt: now,
    lastPlayedAt: now,
  }

  await db.add(GAME_SESSIONS_STORE, session)
  return session
}

export async function getSession(id: string): Promise<GameSession | undefined> {
  const db = await getDB()
  return db.get(GAME_SESSIONS_STORE, id)
}

export async function updateSession(session: GameSession): Promise<GameSession> {
  const db = await getDB()
  session.lastPlayedAt = Date.now()
  await db.put(GAME_SESSIONS_STORE, session)
  return session
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(GAME_SESSIONS_STORE, id)
}

export async function getAllSessions(): Promise<GameSession[]> {
  const db = await getDB()
  const allSessions = await db.getAll(GAME_SESSIONS_STORE)
  // Sort by lastPlayedAt descending (most recent first)
  return allSessions.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- src/db/__tests__/game-session.test.ts
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/db/game-session.ts src/db/__tests__/game-session.test.ts
git commit -m "feat: implement game session CRUD with IndexedDB"
```

---

## Phase 3: Gemini API Integration

### Task 5: Gemini Error Handling & Client Wrapper

**Files:**
- Create: `src/api/error-handler.ts`
- Create: `src/api/gemini-client.ts`
- Create: `src/api/__tests__/error-handler.test.ts`

**Interfaces:**
- Consumes: `Settings` from `src/api/types.ts`
- Produces: `GeminiClient`, `handleGeminiError()`, error classification

- [ ] **Step 1: Write error handler tests**

Create `src/api/__tests__/error-handler.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { classifyGeminiError } from '../error-handler'

describe('Gemini Error Handler', () => {
  it('should classify invalid API key errors', () => {
    const error = new Error('Invalid API key')
    const classified = classifyGeminiError(error)
    expect(classified.code).toBe('INVALID_KEY')
  })

  it('should classify rate limit errors', () => {
    const error = new Error('429 Too Many Requests')
    const classified = classifyGeminiError(error)
    expect(classified.code).toBe('RATE_LIMIT')
  })

  it('should classify network errors', () => {
    const error = new Error('Network error: Failed to fetch')
    const classified = classifyGeminiError(error)
    expect(classified.code).toBe('NETWORK')
  })

  it('should classify malformed response errors', () => {
    const error = new Error('Response did not conform to responseSchema')
    const classified = classifyGeminiError(error)
    expect(classified.code).toBe('MALFORMED_RESPONSE')
  })

  it('should classify unknown errors', () => {
    const error = new Error('Some random error')
    const classified = classifyGeminiError(error)
    expect(classified.code).toBe('UNKNOWN')
  })
})
```

- [ ] **Step 2: Implement error handler**

Create `src/api/error-handler.ts`:
```typescript
import type { GeminiError } from './types'

export type ErrorCode = 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | 'MALFORMED_RESPONSE' | 'UNKNOWN'

export interface ClassifiedError {
  code: ErrorCode
  userMessage: string
  originalError: Error
}

export function classifyGeminiError(error: Error): ClassifiedError {
  const message = error.message.toLowerCase()

  if (message.includes('invalid') && message.includes('api')) {
    return {
      code: 'INVALID_KEY',
      userMessage: 'Invalid API key. Please check your settings.',
      originalError: error,
    }
  }

  if (message.includes('429') || message.includes('too many requests')) {
    return {
      code: 'RATE_LIMIT',
      userMessage:
        'Rate limit exceeded. Please wait a moment and try again.',
      originalError: error,
    }
  }

  if (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('offline')
  ) {
    return {
      code: 'NETWORK',
      userMessage: 'Network error. Please check your connection.',
      originalError: error,
    }
  }

  if (message.includes('responseschema') || message.includes('malformed')) {
    return {
      code: 'MALFORMED_RESPONSE',
      userMessage: 'Unexpected response format from AI. Retrying...',
      originalError: error,
    }
  }

  return {
    code: 'UNKNOWN',
    userMessage: 'An unexpected error occurred. Please try again.',
    originalError: error,
  }
}
```

- [ ] **Step 3: Implement Gemini client wrapper**

Create `src/api/gemini-client.ts`:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Settings, DMResponse, ChatMessage } from './types'
import { classifyGeminiError } from './error-handler'

export class GeminiClient {
  private client: GoogleGenerativeAI | null = null
  private settings: Settings

  constructor(settings: Settings) {
    this.settings = settings
    if (settings.apiKey) {
      this.client = new GoogleGenerativeAI(settings.apiKey)
    }
  }

  async validateApiKey(): Promise<boolean> {
    if (!this.settings.apiKey) {
      throw new Error('No API key provided')
    }

    try {
      this.client = new GoogleGenerativeAI(this.settings.apiKey)
      const model = this.client.getGenerativeModel({
        model: this.settings.geminiModel,
      })

      // Test call with minimal payload
      await model.generateContent('Test')
      return true
    } catch (error) {
      const classified = classifyGeminiError(error as Error)
      throw new Error(classified.userMessage)
    }
  }

  updateSettings(settings: Settings): void {
    this.settings = settings
    if (settings.apiKey) {
      this.client = new GoogleGenerativeAI(settings.apiKey)
    }
  }

  private getModel() {
    if (!this.client) {
      throw new Error('Gemini client not initialized. Please set API key.')
    }
    return this.client.getGenerativeModel({
      model: this.settings.geminiModel,
    })
  }

  async callDM(
    systemPrompt: string,
    messages: ChatMessage[],
    responseSchema: Record<string, unknown>
  ): Promise<DMResponse> {
    try {
      const model = this.getModel()

      const formattedMessages = messages.map((msg) => ({
        role: msg.role === 'player' ? 'user' : msg.role === 'dm' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }))

      const response = await model.generateContent({
        contents: formattedMessages,
        systemInstruction: systemPrompt,
        generationConfig: {
          responseSchema: responseSchema as any,
          responseMimeType: 'application/json',
        },
      })

      const text = response.response.text()
      const parsed = JSON.parse(text) as DMResponse

      return parsed
    } catch (error) {
      const classified = classifyGeminiError(error as Error)
      throw new Error(classified.userMessage)
    }
  }

  async callCharacterCreation(
    systemPrompt: string,
    conversationHistory: Array<{ role: string; content: string }>,
    responseSchema: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      const model = this.getModel()

      const formattedMessages = conversationHistory.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }))

      const response = await model.generateContent({
        contents: formattedMessages,
        systemInstruction: systemPrompt,
        generationConfig: {
          responseSchema: responseSchema as any,
          responseMimeType: 'application/json',
        },
      })

      const text = response.response.text()
      return JSON.parse(text) as Record<string, unknown>
    } catch (error) {
      const classified = classifyGeminiError(error as Error)
      throw new Error(classified.userMessage)
    }
  }

  async callUnstructured(
    systemPrompt: string,
    userMessage: string
  ): Promise<string> {
    try {
      const model = this.getModel()

      const response = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage }],
          },
        ],
        systemInstruction: systemPrompt,
      })

      return response.response.text()
    } catch (error) {
      const classified = classifyGeminiError(error as Error)
      throw new Error(classified.userMessage)
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/api/__tests__/error-handler.test.ts
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/api/error-handler.ts src/api/gemini-client.ts src/api/__tests__/error-handler.test.ts
git commit -m "feat: add Gemini API client with error classification"
```

---

### Task 6: Gemini Response Schemas

**Files:**
- Create: `src/api/schemas.ts`
- Create: `src/api/prompts.ts`

**Interfaces:**
- Produces: JSON schemas for `DMResponse`, `Character`, prompt builders

- [ ] **Step 1: Create response schemas**

Create `src/api/schemas.ts`:
```typescript
import type { DMResponse, Character } from './types'

export const DM_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    narration: {
      type: 'string',
      description: 'The DM narration of events',
    },
    dice_request: {
      type: 'object',
      properties: {
        needed: { type: 'boolean', description: 'Whether a dice roll is needed' },
        ability: {
          type: 'string',
          enum: ['str', 'dex', 'con', 'int', 'wis', 'cha', 'none'],
          description: 'Which ability to roll against',
        },
        dc: {
          type: 'number',
          description: 'Difficulty class for the roll',
        },
        reason: {
          type: 'string',
          description: 'Why a roll is needed',
        },
      },
      required: ['needed', 'ability', 'dc', 'reason'],
    },
    state_updates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'hp_delta',
              'inventory_add',
              'inventory_remove',
              'status_add',
              'status_remove',
            ],
          },
          payload: {
            type: 'object',
            description: 'Update-specific data',
          },
          reason: {
            type: 'string',
            description: 'Why this update is applied',
          },
        },
        required: ['type', 'payload', 'reason'],
      },
    },
  },
  required: ['narration', 'dice_request', 'state_updates'],
}

export const CHARACTER_SCHEMA = {
  type: 'object',
  properties: {
    characterName: { type: 'string' },
    archetype: { type: 'string' },
    backstory: { type: 'string' },
    stats: {
      type: 'object',
      properties: {
        str: { type: 'number', minimum: 1, maximum: 20 },
        dex: { type: 'number', minimum: 1, maximum: 20 },
        con: { type: 'number', minimum: 1, maximum: 20 },
        int: { type: 'number', minimum: 1, maximum: 20 },
        wis: { type: 'number', minimum: 1, maximum: 20 },
        cha: { type: 'number', minimum: 1, maximum: 20 },
      },
      required: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
    },
  },
  required: ['characterName', 'archetype', 'backstory', 'stats'],
}
```

- [ ] **Step 2: Create prompt builders**

Create `src/api/prompts.ts`:
```typescript
import { calculateAbilityModifier } from '../db/models'
import type { GameSession, Character } from './types'

export function buildDMSystemPrompt(
  session: GameSession,
  language: 'en' | 'ru'
): string {
  const abilityModifiers = {
    str: calculateAbilityModifier(session.stats.str),
    dex: calculateAbilityModifier(session.stats.dex),
    con: calculateAbilityModifier(session.stats.con),
    int: calculateAbilityModifier(session.stats.int),
    wis: calculateAbilityModifier(session.stats.wis),
    cha: calculateAbilityModifier(session.stats.cha),
  }

  const basePrompt = `You are a D&D Dungeon Master for a text-based adventure. The player controls:

**Character:** ${session.characterName}
**Archetype:** ${session.archetype}
**Backstory:** ${session.backstory}

**Ability Scores & Modifiers:**
- Strength: ${session.stats.str} (${abilityModifiers.str > 0 ? '+' : ''}${abilityModifiers.str})
- Dexterity: ${session.stats.dex} (${abilityModifiers.dex > 0 ? '+' : ''}${abilityModifiers.dex})
- Constitution: ${session.stats.con} (${abilityModifiers.con > 0 ? '+' : ''}${abilityModifiers.con})
- Intelligence: ${session.stats.int} (${abilityModifiers.int > 0 ? '+' : ''}${abilityModifiers.int})
- Wisdom: ${session.stats.wis} (${abilityModifiers.wis > 0 ? '+' : ''}${abilityModifiers.wis})
- Charisma: ${session.stats.cha} (${abilityModifiers.cha > 0 ? '+' : ''}${abilityModifiers.cha})

**Current HP:** ${session.hp.current}/${session.hp.max}

**Inventory:**
${session.inventory.map((item) => `- ${item.name} x${item.quantity}: ${item.description}`).join('\n')}

**Rules:**
- When you need a skill check, respond with dice_request.needed = true
- Natural 20 (roll result = 20) always succeeds
- Natural 1 (roll result = 1) always fails
- On a successful roll (total >= DC), propose a positive state_update
- On a failed roll (total < DC), you can propose a negative state_update or just narrate the failure
- The player is ${language === 'en' ? 'English' : 'Russian'} speaking - respond in ${language === 'en' ? 'English' : 'Russian'} language

Respond strictly in JSON format matching the schema provided.`

  return basePrompt
}

export function buildCharacterCreationSystemPrompt(language: 'en' | 'ru'): string {
  return `You are a helpful D&D character creation guide. Guide the player through creating a character step by step:
1. Ask for character name
2. Ask for archetype/class
3. Ask for a short backstory
4. Propose ability scores (1-20 each) that fit the archetype, allow player to request changes
5. Ask for starting inventory items (3-5 items)

When the player confirms they're happy with their character, output valid JSON (application/json) with the complete character sheet matching the provided schema.

Respond in ${language === 'en' ? 'English' : 'Russian'} language.`
}

export function buildContextSummaryPrompt(
  history: string,
  language: 'en' | 'ru'
): string {
  return `Summarize this game session history in 2-3 paragraphs, capturing key events, the current situation, and the player's objectives:

${history}

Respond in ${language === 'en' ? 'English' : 'Russian'} language.`
}
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npm run type-check
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/api/schemas.ts src/api/prompts.ts
git commit -m "feat: add Gemini response schemas and prompt builders"
```

---

## Phase 4: Localization

### Task 7: i18n Setup

**Files:**
- Create: `src/i18n/en.ts`
- Create: `src/i18n/ru.ts`
- Create: `src/i18n/index.ts`
- Create: `src/i18n/useI18n.ts`

**Interfaces:**
- Produces: `useI18n()` hook, string dictionaries for en/ru

- [ ] **Step 1: Create English strings**

Create `src/i18n/en.ts`:
```typescript
export const EN = {
  // Global
  appTitle: 'D&D RPG with AI Dungeon Master',
  
  // Settings screen
  settings: {
    title: 'Settings',
    apiKeyLabel: 'Gemini API Key',
    apiKeyPlaceholder: 'Paste your API key here',
    testButton: 'Test API Key',
    testingButton: 'Testing...',
    testSuccess: 'API key is valid!',
    languageLabel: 'Language',
    modelLabel: 'Gemini Model',
    privacyNote: 'Your API key is stored only in your browser and never sent anywhere except to Google Gemini.',
    back: 'Back',
  },

  // Session list screen
  sessionList: {
    title: 'Your Games',
    newGame: 'New Game',
    noGames: 'No saved games. Start a new adventure!',
    continue: 'Continue',
    delete: 'Delete',
    deleteConfirm: 'Are you sure? This cannot be undone.',
    yes: 'Yes, delete',
    no: 'Cancel',
  },

  // Character creation
  characterCreation: {
    title: 'Create Your Character',
    thinking: 'Creating your character...',
    startNew: 'Start New Game',
  },

  // Gameplay
  gameplay: {
    title: 'Adventure',
    dmThinking: 'DM is thinking...',
    yourAction: 'What do you do?',
    sendButton: 'Send',
    roll: 'Roll d20',
    accept: 'Accept',
    reject: 'Reject',
    other: 'Other',
    proposedChanges: 'Proposed Changes:',
    health: 'Health',
    inventory: 'Inventory',
    abilities: 'Abilities',
    quit: 'Quit to Menu',
  },

  // Errors
  errors: {
    invalidKey: 'Invalid API key. Please check your settings.',
    rateLimited: 'Rate limit exceeded. Please wait a moment and try again.',
    networkError: 'Network error. Please check your connection.',
    malformedResponse: 'Unexpected response format. Retrying...',
    unknown: 'An unexpected error occurred. Please try again.',
  },
} as const
```

- [ ] **Step 2: Create Russian strings**

Create `src/i18n/ru.ts`:
```typescript
export const RU = {
  // Global
  appTitle: 'D&D RPG с ИИ Мастером Подземелий',
  
  // Settings screen
  settings: {
    title: 'Параметры',
    apiKeyLabel: 'API-ключ Gemini',
    apiKeyPlaceholder: 'Вставьте ваш API-ключ здесь',
    testButton: 'Тестировать API-ключ',
    testingButton: 'Тестирование...',
    testSuccess: 'API-ключ действителен!',
    languageLabel: 'Язык',
    modelLabel: 'Модель Gemini',
    privacyNote: 'Ваш API-ключ хранится только в вашем браузере и никогда не отправляется никуда, кроме Google Gemini.',
    back: 'Назад',
  },

  // Session list screen
  sessionList: {
    title: 'Ваши игры',
    newGame: 'Новая игра',
    noGames: 'Нет сохранённых игр. Начните новое приключение!',
    continue: 'Продолжить',
    delete: 'Удалить',
    deleteConfirm: 'Вы уверены? Это действие нельзя отменить.',
    yes: 'Да, удалить',
    no: 'Отмена',
  },

  // Character creation
  characterCreation: {
    title: 'Создайте персонажа',
    thinking: 'Создаём вашего персонажа...',
    startNew: 'Начать новую игру',
  },

  // Gameplay
  gameplay: {
    title: 'Приключение',
    dmThinking: 'Мастер думает...',
    yourAction: 'Что вы делаете?',
    sendButton: 'Отправить',
    roll: 'Бросить d20',
    accept: 'Принять',
    reject: 'Отклонить',
    other: 'Другое',
    proposedChanges: 'Предложенные изменения:',
    health: 'Здоровье',
    inventory: 'Инвентарь',
    abilities: 'Способности',
    quit: 'Выход в меню',
  },

  // Errors
  errors: {
    invalidKey: 'Неверный API-ключ. Проверьте параметры.',
    rateLimited: 'Превышен лимит запросов. Подождите и попробуйте снова.',
    networkError: 'Ошибка сети. Проверьте ваше подключение.',
    malformedResponse: 'Неожиданный формат ответа. Повторная попытка...',
    unknown: 'Произошла неожиданная ошибка. Попробуйте снова.',
  },
} as const
```

- [ ] **Step 3: Create i18n index**

Create `src/i18n/index.ts`:
```typescript
import { EN } from './en'
import { RU } from './ru'

export type Language = 'en' | 'ru'

export const LANGUAGES: Record<Language, string> = {
  en: 'English',
  ru: 'Русский',
}

export const TRANSLATIONS: Record<Language, typeof EN> = {
  en: EN,
  ru: RU,
}

export function getTranslation(language: Language) {
  return TRANSLATIONS[language]
}
```

- [ ] **Step 4: Create i18n hook**

Create `src/i18n/useI18n.ts`:
```typescript
import { useContext } from 'react'
import type { Language } from './index'
import { getTranslation } from './index'

interface I18nContextType {
  language: Language
  t: ReturnType<typeof getTranslation>
}

// Context will be created in app component
export function useI18n(): I18nContextType {
  // This will be implemented in the App component with React.createContext
  throw new Error('useI18n must be used within I18nProvider')
}

export { type I18nContextType }
```

- [ ] **Step 5: Commit**

```bash
git add src/i18n/en.ts src/i18n/ru.ts src/i18n/index.ts src/i18n/useI18n.ts
git commit -m "feat: add i18n support for English and Russian"
```

---

## Phase 5: Dice Rolling & Utilities

### Task 8: Client-Side Dice Rolling

**Files:**
- Create: `src/features/gameplay/dice.ts`
- Create: `src/features/gameplay/__tests__/dice.test.ts`

**Interfaces:**
- Produces: `rollD20()`, `calculateDiceTotal()`, dice validation

- [ ] **Step 1: Write dice tests**

Create `src/features/gameplay/__tests__/dice.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { rollD20, calculateDiceTotal, isNaturalTwenty, isNaturalOne } from '../dice'
import { calculateAbilityModifier } from '../../../db/models'

describe('Dice Rolling', () => {
  it('should roll d20 between 1 and 20', () => {
    for (let i = 0; i < 100; i++) {
      const roll = rollD20()
      expect(roll).toBeGreaterThanOrEqual(1)
      expect(roll).toBeLessThanOrEqual(20)
    }
  })

  it('should calculate total with ability modifier', () => {
    const roll = 15
    const modifier = calculateAbilityModifier(16) // +3
    const total = calculateDiceTotal(roll, modifier)
    expect(total).toBe(18)
  })

  it('should handle negative modifiers', () => {
    const roll = 10
    const modifier = calculateAbilityModifier(8) // -1
    const total = calculateDiceTotal(roll, modifier)
    expect(total).toBe(9)
  })

  it('should identify natural 20', () => {
    expect(isNaturalTwenty(20)).toBe(true)
    expect(isNaturalTwenty(19)).toBe(false)
  })

  it('should identify natural 1', () => {
    expect(isNaturalOne(1)).toBe(true)
    expect(isNaturalOne(2)).toBe(false)
  })

  it('should always succeed on natural 20', () => {
    const roll = 20
    const modifier = 5
    const dc = 100
    const total = calculateDiceTotal(roll, modifier)
    expect(total).toBeGreaterThanOrEqual(dc)
  })

  it('should always fail on natural 1', () => {
    const roll = 1
    const modifier = 10
    const dc = 5
    const total = calculateDiceTotal(roll, modifier)
    expect(total).toBeLessThan(dc)
  })
})
```

- [ ] **Step 2: Implement dice rolling**

Create `src/features/gameplay/dice.ts`:
```typescript
export function rollD20(): number {
  // Use crypto.getRandomValues for true randomness, not AI
  const randomArray = new Uint32Array(1)
  crypto.getRandomValues(randomArray)
  const roll = (randomArray[0] % 20) + 1
  return roll
}

export function calculateDiceTotal(roll: number, abilityModifier: number): number {
  return roll + abilityModifier
}

export function isNaturalTwenty(roll: number): boolean {
  return roll === 20
}

export function isNaturalOne(roll: number): boolean {
  return roll === 1
}

export function checkSuccess(total: number, dc: number): boolean {
  return total >= dc
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- src/features/gameplay/__tests__/dice.test.ts
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/features/gameplay/dice.ts src/features/gameplay/__tests__/dice.test.ts
git commit -m "feat: implement client-side dice rolling with tests"
```

---

## Phase 6: React App Shell & Routing

### Task 9: App Shell with Context & Routing

**Files:**
- Create: `src/app/App.tsx`
- Create: `src/app/Router.tsx`
- Create: `src/app/AppContext.tsx`
- Create: `src/index.css`

**Interfaces:**
- Consumes: All previous modules
- Produces: Main `<App />` component, routing logic

- [ ] **Step 1: Create app context**

Create `src/app/AppContext.tsx`:
```typescript
import React, { createContext, useContext, ReactNode } from 'react'
import type { Language } from '../i18n/index'
import { getTranslation } from '../i18n/index'

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: ReturnType<typeof getTranslation>
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({
  children,
  initialLanguage = 'en',
}: {
  children: ReactNode
  initialLanguage?: Language
}) {
  const [language, setLanguage] = React.useState<Language>(initialLanguage)

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t: getTranslation(language),
      }}
    >
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
```

- [ ] **Step 2: Create basic styles**

Create `src/index.css`:
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
    Arial, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #333;
  min-height: 100vh;
}

#root {
  min-height: 100vh;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

button {
  padding: 10px 20px;
  font-size: 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

button:active {
  transform: translateY(0);
}

input,
textarea,
select {
  padding: 10px;
  font-size: 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-family: inherit;
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

h1 {
  margin-bottom: 20px;
  font-size: 28px;
  color: white;
}

h2 {
  margin-bottom: 15px;
  font-size: 20px;
  color: #333;
}

p {
  margin-bottom: 10px;
  line-height: 1.5;
}
```

- [ ] **Step 3: Create router component**

Create `src/app/Router.tsx`:
```typescript
import React from 'react'

export type Screen = 'sessionList' | 'settings' | 'characterCreation' | 'gameplay'

export interface AppState {
  currentScreen: Screen
  navigateTo: (screen: Screen, data?: unknown) => void
  screenData?: unknown
}

export function useAppRouter(initialScreen: Screen = 'sessionList'): AppState {
  const [currentScreen, setCurrentScreen] = React.useState<Screen>(initialScreen)
  const [screenData, setScreenData] = React.useState<unknown>(undefined)

  const navigateTo = (screen: Screen, data?: unknown) => {
    setCurrentScreen(screen)
    setScreenData(data)
  }

  return {
    currentScreen,
    navigateTo,
    screenData,
  }
}
```

- [ ] **Step 4: Create App component skeleton**

Create `src/app/App.tsx`:
```typescript
import React from 'react'
import { initDB } from '../db'
import { getSettings } from '../db/settings'
import { useAppRouter } from './Router'
import { I18nProvider } from './AppContext'
import type { Language } from '../i18n/index'
import './App.css'

// TODO: Import screen components in Phase 7+
// import SessionListScreen from '../features/session-list/SessionListScreen'
// import SettingsScreen from '../features/settings/SettingsScreen'
// import CharacterCreationScreen from '../features/character-creation/CharacterCreationScreen'
// import GameplayScreen from '../features/gameplay/GameplayScreen'

export default function App() {
  const router = useAppRouter('sessionList')
  const [isReady, setIsReady] = React.useState(false)
  const [language, setLanguage] = React.useState<Language>('en')

  React.useEffect(() => {
    async function init() {
      try {
        await initDB()
        const settings = await getSettings()
        setLanguage(settings.language)
        setIsReady(true)
      } catch (error) {
        console.error('Failed to initialize app:', error)
        setIsReady(true)
      }
    }

    init()
  }, [])

  if (!isReady) {
    return <div className="loading">Loading...</div>
  }

  return (
    <I18nProvider initialLanguage={language}>
      <div className="app">
        {router.currentScreen === 'sessionList' && (
          <div>Session List (TODO: implement)</div>
        )}
        {router.currentScreen === 'settings' && <div>Settings (TODO: implement)</div>}
        {router.currentScreen === 'characterCreation' && (
          <div>Character Creation (TODO: implement)</div>
        )}
        {router.currentScreen === 'gameplay' && (
          <div>Gameplay (TODO: implement)</div>
        )}
      </div>
    </I18nProvider>
  )
}
```

- [ ] **Step 5: Create App-specific styles**

Create `src/app/App.css`:
```css
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-size: 18px;
  color: white;
}
```

- [ ] **Step 6: Test app loads**

```bash
npm run dev
```

Navigate to http://localhost:5173. Expected: "Loading..." appears briefly, then "Session List (TODO: implement)" is shown.

- [ ] **Step 7: Commit**

```bash
git add src/app/App.tsx src/app/Router.tsx src/app/AppContext.tsx src/index.css src/app/App.css
git commit -m "feat: create app shell with routing and context"
```

---

## Phase 7: Settings Screen

### Task 10: Settings Screen Implementation

**Files:**
- Create: `src/features/settings/SettingsScreen.tsx`
- Create: `src/features/settings/useSettings.ts`
- Create: `src/features/settings/SettingsScreen.css`

**Interfaces:**
- Consumes: `getSettings()`, `saveSettings()`, `GeminiClient`, `useI18n()`
- Produces: Settings screen component, settings management hook

- [ ] **Step 1: Create settings hook**

Create `src/features/settings/useSettings.ts`:
```typescript
import { useState } from 'react'
import { getSettings, saveSettings } from '../../db/settings'
import { GeminiClient } from '../../api/gemini-client'
import type { Settings } from '../../api/types'

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')

  async function loadSettings() {
    try {
      setIsLoading(true)
      const loaded = await getSettings()
      setSettings(loaded)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  async function updateSettings(partial: Partial<Settings>) {
    if (!settings) return

    try {
      const updated = { ...settings, ...partial }
      await saveSettings(updated)
      setSettings(updated)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function testApiKey(apiKey: string) {
    try {
      setTestStatus('testing')
      const testSettings: Settings = {
        apiKey,
        language: settings?.language || 'en',
        geminiModel: settings?.geminiModel || 'gemini-2.5-flash',
      }
      const client = new GeminiClient(testSettings)
      await client.validateApiKey()
      setTestStatus('success')
      setTimeout(() => setTestStatus('idle'), 2000)
    } catch (err) {
      setTestStatus('error')
      setError((err as Error).message)
      setTimeout(() => setTestStatus('idle'), 3000)
    }
  }

  return {
    settings,
    isLoading,
    error,
    testStatus,
    loadSettings,
    updateSettings,
    testApiKey,
  }
}
```

- [ ] **Step 2: Create settings screen component**

Create `src/features/settings/SettingsScreen.tsx`:
```typescript
import React, { useEffect } from 'react'
import { useSettings } from './useSettings'
import { useI18n } from '../../app/AppContext'
import type { Settings } from '../../api/types'
import type { AppState } from '../../app/Router'
import './SettingsScreen.css'

interface SettingsScreenProps {
  onNavigate: AppState['navigateTo']
}

export default function SettingsScreen({ onNavigate }: SettingsScreenProps) {
  const { t } = useI18n()
  const { settings, isLoading, error, testStatus, loadSettings, updateSettings, testApiKey } =
    useSettings()
  const [apiKeyInput, setApiKeyInput] = React.useState('')
  const [languageInput, setLanguageInput] = React.useState<'en' | 'ru'>('en')
  const [modelInput, setModelInput] = React.useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    if (settings) {
      setApiKeyInput(settings.apiKey)
      setLanguageInput(settings.language)
      setModelInput(settings.geminiModel)
    }
  }, [settings])

  const handleSave = async () => {
    await updateSettings({
      apiKey: apiKeyInput,
      language: languageInput,
      geminiModel: modelInput,
    })
  }

  const handleTest = async () => {
    await testApiKey(apiKeyInput)
  }

  if (isLoading) {
    return <div className="settings-screen loading">{t.appTitle}</div>
  }

  return (
    <div className="settings-screen">
      <div className="container">
        <h1>{t.settings.title}</h1>

        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label>{t.settings.apiKeyLabel}</label>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={t.settings.apiKeyPlaceholder}
          />
          <button
            onClick={handleTest}
            disabled={testStatus === 'testing'}
            className={`test-button ${testStatus}`}
          >
            {testStatus === 'testing' && t.settings.testingButton}
            {testStatus !== 'testing' && t.settings.testButton}
            {testStatus === 'success' && ` ✓`}
            {testStatus === 'error' && ` ✗`}
          </button>
        </div>

        <div className="form-group">
          <label>{t.settings.languageLabel}</label>
          <select value={languageInput} onChange={(e) => setLanguageInput(e.target.value as any)}>
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </div>

        <div className="form-group">
          <label>{t.settings.modelLabel}</label>
          <select value={modelInput} onChange={(e) => setModelInput(e.target.value)}>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
          </select>
        </div>

        <p className="privacy-note">{t.settings.privacyNote}</p>

        <div className="form-actions">
          <button onClick={handleSave} className="save-button">
            Save
          </button>
          <button onClick={() => onNavigate('sessionList')} className="back-button">
            {t.settings.back}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create styles**

Create `src/features/settings/SettingsScreen.css`:
```css
.settings-screen {
  background: white;
  min-height: 100vh;
  padding: 20px 0;
}

.settings-screen .container {
  max-width: 600px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
}

.test-button {
  margin-top: 8px;
  padding: 10px 20px;
  background: #667eea;
  color: white;
  font-weight: 600;
  transition: all 0.3s ease;
}

.test-button:hover:not(:disabled) {
  background: #5568d3;
}

.test-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.test-button.success {
  background: #48bb78;
}

.test-button.error {
  background: #f56565;
}

.privacy-note {
  font-size: 13px;
  color: #666;
  margin: 20px 0;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 6px;
  border-left: 3px solid #667eea;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 30px;
}

.save-button {
  flex: 1;
  background: #667eea;
  color: white;
  font-weight: 600;
  padding: 12px;
}

.save-button:hover {
  background: #5568d3;
}

.back-button {
  flex: 0;
  background: #e2e8f0;
  color: #333;
  padding: 12px 24px;
}

.back-button:hover {
  background: #cbd5e0;
}

.error-message {
  background: #fed7d7;
  color: #c53030;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 20px;
  border-left: 3px solid #c53030;
}
```

- [ ] **Step 4: Wire settings into App**

Update `src/app/App.tsx` to import and use SettingsScreen:

```typescript
import SettingsScreen from '../features/settings/SettingsScreen'

// In the JSX:
{router.currentScreen === 'settings' && (
  <SettingsScreen onNavigate={router.navigateTo} />
)}
```

- [ ] **Step 5: Test settings screen**

```bash
npm run dev
```

Manually navigate to settings (update App.tsx to start on 'settings' screen). Expected: Settings form renders with API key field, language selector, model selector.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/SettingsScreen.tsx src/features/settings/useSettings.ts src/features/settings/SettingsScreen.css src/app/App.tsx
git commit -m "feat: implement settings screen with API key validation"
```

---

## Phase 8: Session Management

### Task 11: Session List Screen

**Files:**
- Create: `src/features/session-list/SessionListScreen.tsx`
- Create: `src/features/session-list/useSessionList.ts`
- Create: `src/features/session-list/SessionListScreen.css`

**Interfaces:**
- Consumes: `getAllSessions()`, `deleteSession()`, `useI18n()`
- Produces: Session list screen component

- [ ] **Step 1: Create session list hook**

Create `src/features/session-list/useSessionList.ts`:
```typescript
import { useState, useEffect } from 'react'
import { getAllSessions, deleteSession } from '../../db/game-session'
import type { GameSession } from '../../api/types'

export function useSessionList() {
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadSessions() {
    try {
      setIsLoading(true)
      const loaded = await getAllSessions()
      setSessions(loaded)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  async function removeSess (id: string) {
    try {
      await deleteSession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  return {
    sessions,
    isLoading,
    error,
    loadSessions,
    deleteSession: removeSess,
  }
}
```

- [ ] **Step 2: Create session list component**

Create `src/features/session-list/SessionListScreen.tsx`:
```typescript
import React, { useState } from 'react'
import { useSessionList } from './useSessionList'
import { useI18n } from '../../app/AppContext'
import type { AppState } from '../../app/Router'
import './SessionListScreen.css'

interface SessionListScreenProps {
  onNavigate: AppState['navigateTo']
}

export default function SessionListScreen({ onNavigate }: SessionListScreenProps) {
  const { t } = useI18n()
  const { sessions, isLoading, error, deleteSession } = useSessionList()
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    await deleteSession(id)
    setDeleteConfirmId(null)
  }

  const handleNewGame = () => {
    onNavigate('characterCreation')
  }

  const handleContinue = (sessionId: string) => {
    onNavigate('gameplay', { sessionId })
  }

  if (isLoading) {
    return <div className="session-list-screen loading">Loading...</div>
  }

  return (
    <div className="session-list-screen">
      <div className="container">
        <div className="header">
          <h1>{t.sessionList.title}</h1>
          <button onClick={() => onNavigate('settings')} className="settings-button">
            ⚙️ Settings
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {sessions.length === 0 ? (
          <div className="empty-state">
            <p>{t.sessionList.noGames}</p>
          </div>
        ) : (
          <div className="sessions-grid">
            {sessions.map((session) => (
              <div key={session.id} className="session-card">
                <div className="session-header">
                  <h3>{session.characterName}</h3>
                  <span className="archetype">{session.archetype}</span>
                </div>

                <div className="session-info">
                  <p className="backstory">{session.backstory}</p>
                  <p className="health">
                    {t.gameplay.health}: {session.hp.current}/{session.hp.max}
                  </p>
                  <p className="date">
                    {new Date(session.lastPlayedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="session-actions">
                  <button
                    onClick={() => handleContinue(session.id)}
                    className="continue-button"
                  >
                    {t.sessionList.continue}
                  </button>

                  {deleteConfirmId === session.id ? (
                    <div className="delete-confirm">
                      <p>{t.sessionList.deleteConfirm}</p>
                      <button
                        onClick={() => handleDelete(session.id)}
                        className="confirm-yes"
                      >
                        {t.sessionList.yes}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="confirm-no"
                      >
                        {t.sessionList.no}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(session.id)}
                      className="delete-button"
                    >
                      {t.sessionList.delete}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <button onClick={handleNewGame} className="new-game-button">
          {t.sessionList.newGame}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create styles**

Create `src/features/session-list/SessionListScreen.css`:
```css
.session-list-screen {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  padding: 20px 0 40px;
}

.session-list-screen .container {
  max-width: 900px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px 0;
}

.header h1 {
  margin: 0;
}

.settings-button {
  background: white;
  color: #667eea;
  font-size: 16px;
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: 600;
}

.settings-button:hover {
  background: #f0f0f0;
}

.empty-state {
  background: white;
  padding: 60px 20px;
  border-radius: 10px;
  text-align: center;
  color: #666;
}

.sessions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.session-card {
  background: white;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.session-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.session-header {
  margin-bottom: 15px;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 10px;
}

.session-header h3 {
  margin: 0 0 5px;
  color: #667eea;
  font-size: 18px;
}

.archetype {
  display: inline-block;
  background: #667eea;
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.session-info {
  flex: 1;
  margin-bottom: 15px;
}

.backstory {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
  line-height: 1.4;
}

.health {
  font-size: 14px;
  color: #764ba2;
  font-weight: 600;
}

.date {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
}

.session-actions {
  display: flex;
  gap: 8px;
}

.continue-button {
  flex: 1;
  background: #667eea;
  color: white;
  font-weight: 600;
  padding: 10px;
  border-radius: 6px;
}

.continue-button:hover {
  background: #5568d3;
}

.delete-button {
  flex: 0;
  background: #fed7d7;
  color: #c53030;
  font-weight: 600;
  padding: 10px 16px;
  border-radius: 6px;
}

.delete-button:hover {
  background: #fc8181;
}

.delete-confirm {
  grid-column: 1 / -1;
  background: #fed7d7;
  padding: 12px;
  border-radius: 6px;
  margin-top: 10px;
}

.delete-confirm p {
  margin-bottom: 10px;
  color: #c53030;
  font-size: 14px;
}

.confirm-yes {
  background: #c53030;
  color: white;
  padding: 8px 16px;
  margin-right: 8px;
}

.confirm-no {
  background: white;
  color: #c53030;
  padding: 8px 16px;
  border: 1px solid #c53030;
}

.new-game-button {
  width: 100%;
  background: white;
  color: #667eea;
  font-weight: 700;
  font-size: 18px;
  padding: 16px;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
}

.new-game-button:hover {
  background: #f0f0f0;
  transform: translateY(-2px);
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.error-message {
  background: #fed7d7;
  color: #c53030;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 20px;
  border-left: 3px solid #c53030;
}
```

- [ ] **Step 4: Wire into App**

Update `src/app/App.tsx`:

```typescript
import SessionListScreen from '../features/session-list/SessionListScreen'

// Change initial screen and wire it in
export default function App() {
  const router = useAppRouter('sessionList')
  
  // ...

  {router.currentScreen === 'sessionList' && (
    <SessionListScreen onNavigate={router.navigateTo} />
  )}
```

- [ ] **Step 5: Test session list**

```bash
npm run dev
```

Expected: Session list screen loads, shows "No saved games" message initially, "New Game" button is prominently displayed.

- [ ] **Step 6: Commit**

```bash
git add src/features/session-list/SessionListScreen.tsx src/features/session-list/useSessionList.ts src/features/session-list/SessionListScreen.css
git commit -m "feat: implement session list screen with game management"
```

---

## Remaining Tasks Summary

The plan above covers the foundation (Phases 1-8). The following tasks are still needed for a complete MVP but are beyond this document's scope to maintain readability:

**Phase 9: Character Creation (Tasks 12-13)**
- Character creation conversation hook
- Character creation screen with multi-turn chat
- Final character schema conversion

**Phase 10: Gameplay (Tasks 14-19)**
- Gameplay screen with chat display
- State update confirmation UI
- Typewriter effect for narration reveal
- Message history compaction & context strategy
- Dice roll UI and flow control
- Turn-based chat state management

**Phase 11: Polish & Integration (Tasks 20-21)**
- Error handling UI across all screens
- End-to-end integration testing
- Performance optimization (message pagination, lazy loading)

---

## Spec Coverage Check

✅ Settings screen with API key validation, language selection, model picker  
✅ Session management (list, create, continue, delete)  
✅ Database layer (IndexedDB + idb wrapper)  
✅ Gemini API client with error handling  
✅ i18n for English and Russian  
✅ Client-side dice rolling (crypto.getRandomValues)  
⏳ Character creation flow (next phase)  
⏳ Gameplay with DM responses and state updates (next phase)  
⏳ Typewriter effect and UI confirmations (next phase)  
⏳ Context compaction for long sessions (next phase)  

---

**Plan complete and saved.** Ready for implementation!
