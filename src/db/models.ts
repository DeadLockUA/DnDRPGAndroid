import type { Settings, Stats, Ability } from '../api/types'

export const DB_NAME = 'DnDRPG'
export const DB_VERSION = 1
export const GAME_SESSIONS_STORE = 'gameSessions'
export const SETTINGS_STORE = 'settings'
export const SETTINGS_KEY = 'user_settings'

export const DEFAULT_MODEL = 'gemini-2.5-flash'

export const AVAILABLE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
] as const

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  language: 'en',
  geminiModel: DEFAULT_MODEL,
}

export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

/** Standard D&D ability modifier: floor((score - 10) / 2). */
export function calculateAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function abilityModifiers(stats: Stats): Record<Ability, number> {
  return {
    str: calculateAbilityModifier(stats.str),
    dex: calculateAbilityModifier(stats.dex),
    con: calculateAbilityModifier(stats.con),
    int: calculateAbilityModifier(stats.int),
    wis: calculateAbilityModifier(stats.wis),
    cha: calculateAbilityModifier(stats.cha),
  }
}

export function generateSessionId(): string {
  const rand = crypto.getRandomValues(new Uint32Array(2))
  return `session_${Date.now().toString(36)}_${rand[0].toString(36)}${rand[1].toString(36)}`
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}
