import { getDB } from './index'
import { GAME_SESSIONS_STORE, generateSessionId } from './models'
import type { GameSession } from '../api/types'

export type NewSessionData = Omit<
  GameSession,
  'id' | 'createdAt' | 'lastPlayedAt'
>

export async function createSession(
  data: NewSessionData,
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

export async function getSession(
  id: string,
): Promise<GameSession | undefined> {
  const db = await getDB()
  return db.get(GAME_SESSIONS_STORE, id)
}

/** Persists the session, stamping lastPlayedAt. Mutates and returns the input. */
export async function updateSession(
  session: GameSession,
): Promise<GameSession> {
  const db = await getDB()
  session.lastPlayedAt = Date.now()
  await db.put(GAME_SESSIONS_STORE, session)
  return session
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(GAME_SESSIONS_STORE, id)
}

/** All sessions, most-recently-played first. */
export async function getAllSessions(): Promise<GameSession[]> {
  const db = await getDB()
  const all = await db.getAll(GAME_SESSIONS_STORE)
  return all.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
}
