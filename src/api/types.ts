// Shared domain types for the game, persistence, and the DM protocol.

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
export type AbilityOrNone = Ability | 'none'
export type Language = 'ru' | 'en'

export interface Stats {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

export interface InventoryItem {
  name: string
  description: string
  quantity: number
}

export interface StatusEffect {
  name: string
  description: string
}

export interface DiceResult {
  ability: AbilityOrNone
  roll: number // raw d20, 1-20
  modifier: number
  total: number
  dc: number
  success: boolean
  isNaturalTwenty: boolean
  isNaturalOne: boolean
}

export interface ChatMessage {
  role: 'dm' | 'player' | 'system'
  content: string
  timestamp: number
  diceResult?: DiceResult
  stateUpdatesApplied?: boolean
}

// ---- DM response protocol (Gemini structured output) ----

export interface DiceRequest {
  needed: boolean
  ability: AbilityOrNone
  dc: number
  reason: string
}

export type StateUpdateType =
  | 'hp_delta'
  | 'inventory_add'
  | 'inventory_remove'
  | 'status_add'
  | 'status_remove'

// Payloads are narrow per-type; we keep a discriminated union for safe application.
export interface HpDeltaPayload {
  amount: number // can be negative (damage) or positive (healing)
}
export interface InventoryAddPayload {
  name: string
  description: string
  quantity: number
}
export interface InventoryRemovePayload {
  name: string
  quantity: number
}
export interface StatusAddPayload {
  name: string
  description: string
}
export interface StatusRemovePayload {
  name: string
}

export interface StateUpdate {
  type: StateUpdateType
  payload:
    | HpDeltaPayload
    | InventoryAddPayload
    | InventoryRemovePayload
    | StatusAddPayload
    | StatusRemovePayload
  reason: string
}

export interface DMResponse {
  narration: string
  dice_request: DiceRequest
  state_updates: StateUpdate[]
}

// ---- Character creation protocol ----

export interface CharacterSheet {
  characterName: string
  archetype: string
  backstory: string
  stats: Stats
  maxHp: number
  inventory: InventoryItem[]
}

// One turn of the character-creation chat. `ready` flips true once the guide
// has gathered everything, which auto-starts the adventure.
export interface CreationReply {
  message: string
  ready: boolean
}

// ---- Persistence ----

export interface GameSession {
  id: string
  characterName: string
  archetype: string
  backstory: string
  stats: Stats
  hp: { current: number; max: number }
  inventory: InventoryItem[]
  statuses: StatusEffect[]
  messages: ChatMessage[]
  summary: string
  createdAt: number
  lastPlayedAt: number
}

export interface Settings {
  apiKey: string
  language: Language
  geminiModel: string
}

// ---- Errors ----

export type GeminiErrorCode =
  | 'INVALID_KEY'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'MALFORMED_RESPONSE'
  | 'NO_KEY'
  | 'UNKNOWN'

export class GeminiError extends Error {
  code: GeminiErrorCode
  /** Suggested wait before retrying, in ms (parsed from a 429 response). */
  retryAfterMs?: number
  constructor(code: GeminiErrorCode, message: string, retryAfterMs?: number) {
    super(message)
    this.name = 'GeminiError'
    this.code = code
    this.retryAfterMs = retryAfterMs
  }
}
