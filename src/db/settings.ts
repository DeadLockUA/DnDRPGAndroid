import { getDB } from './index'
import { SETTINGS_STORE, SETTINGS_KEY, DEFAULT_SETTINGS } from './models'
import type { Settings } from '../api/types'

export async function getSettings(): Promise<Settings> {
  const db = await getDB()
  const stored = await db.get(SETTINGS_STORE, SETTINGS_KEY)
  if (!stored) return { ...DEFAULT_SETTINGS }
  const { key: _key, ...settings } = stored
  return settings
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDB()
  await db.put(SETTINGS_STORE, { ...settings, key: SETTINGS_KEY })
}
