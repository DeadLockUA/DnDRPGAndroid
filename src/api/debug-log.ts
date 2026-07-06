// Tiny pub/sub buffer of raw Gemini requests/responses for the debug panel.

export interface DebugEntry {
  id: number
  ts: number
  kind: string
  model: string
  systemInstruction?: string
  contents: string
  response?: string
  error?: string
}

const MAX = 40
let entries: DebugEntry[] = []
let seq = 0
const listeners = new Set<() => void>()

export function pushDebug(e: Omit<DebugEntry, 'id' | 'ts'>): void {
  entries = [{ ...e, id: ++seq, ts: Date.now() }, ...entries].slice(0, MAX)
  listeners.forEach((l) => l())
}

export function clearDebug(): void {
  entries = []
  listeners.forEach((l) => l())
}

// Stable snapshot for useSyncExternalStore (reference changes only on push).
export function getDebugEntries(): DebugEntry[] {
  return entries
}

export function subscribeDebug(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
