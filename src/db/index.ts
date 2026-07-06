import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import {
  DB_NAME,
  DB_VERSION,
  GAME_SESSIONS_STORE,
  SETTINGS_STORE,
} from './models'
import type { GameSession, Settings } from '../api/types'

// Settings are stored as a single record keyed by a fixed string.
type StoredSettings = Settings & { key: string }

interface DnDRPGDB extends DBSchema {
  [GAME_SESSIONS_STORE]: {
    key: string
    value: GameSession
    indexes: { 'by-last-played': number }
  }
  [SETTINGS_STORE]: {
    key: string
    value: StoredSettings
  }
}

let dbInstance: IDBPDatabase<DnDRPGDB> | null = null

export async function initDB(): Promise<IDBPDatabase<DnDRPGDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<DnDRPGDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(GAME_SESSIONS_STORE)) {
        const store = db.createObjectStore(GAME_SESSIONS_STORE, {
          keyPath: 'id',
        })
        store.createIndex('by-last-played', 'lastPlayedAt')
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
      }
    },
  })

  return dbInstance
}

export async function getDB(): Promise<IDBPDatabase<DnDRPGDB>> {
  if (!dbInstance) return initDB()
  return dbInstance
}

/** Test-only: drops the cached handle so a fresh DB can be reopened. */
export function _resetDBHandle(): void {
  dbInstance?.close()
  dbInstance = null
}

export type { StoredSettings }
