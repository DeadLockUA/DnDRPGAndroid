import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../app/AppContext'
import type {
  GameSession,
  ChatMessage,
  DiceRequest,
  DiceResult,
} from '../../api/types'
import { GeminiError } from '../../api/types'
import { getSession, updateSession } from '../../db/game-session'
import { resolveRoll } from './dice'
import { applyStateUpdates } from './state-updates'

export type Phase =
  | 'loading'
  | 'idle' // awaiting player action
  | 'thinking' // awaiting a DM call
  | 'awaitingRoll' // DM asked for a dice roll
  | 'defeated'
  | 'error-loading'

const KICKOFF =
  'Begin the adventure. Describe the opening scene and the character’s immediate situation, then invite the first action.'

function ts() {
  return Date.now()
}

/** Build the message list to send to the model, honoring the summary window. */
function historyForModel(session: GameSession): ChatMessage[] {
  if (session.summary) return session.messages.slice(-12)
  return session.messages
}

export function useGameplay(sessionId: string) {
  const { gemini, language } = useApp()
  const [session, setSession] = useState<GameSession | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [pendingRoll, setPendingRoll] = useState<DiceRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryAfterMs, setRetryAfterMs] = useState<number | null>(null)
  const startedRef = useRef(false)
  // The most recent DM turn, so a failed call can be replayed verbatim.
  const lastTurnRef = useRef<{
    s: GameSession
    history: ChatMessage[]
    allowDice: boolean
  } | null>(null)

  const persist = useCallback(async (s: GameSession) => {
    await updateSession(s)
    // New object reference so React re-renders.
    setSession({ ...s })
  }, [])

  const showError = useCallback((e: unknown) => {
    if (e instanceof GeminiError) {
      setError(e.code)
      setRetryAfterMs(e.retryAfterMs ?? null)
    } else {
      setError('UNKNOWN')
      setRetryAfterMs(null)
    }
  }, [])

  // Maybe compact old history into a prose summary.
  const maybeSummarize = useCallback(
    async (s: GameSession) => {
      if (s.messages.length <= 40 || s.messages.length % 10 !== 0) return
      const older = s.messages.slice(0, -10)
      const transcript = older
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n')
      try {
        s.summary = await gemini.summarize(transcript, language)
      } catch {
        // Non-fatal: keep playing without a refreshed summary.
      }
    },
    [gemini, language],
  )

  // Process a fresh DM response into UI state / stored messages.
  // `allowDice` is false for the opening scene, where the player hasn't acted
  // yet, so a roll must never be offered preemptively.
  const applyDMResponse = useCallback(
    async (
      s: GameSession,
      resp: Awaited<ReturnType<typeof gemini.generateDMTurn>>,
      allowDice: boolean,
    ) => {
      s.messages.push({ role: 'dm', content: resp.narration, timestamp: ts() })

      if (allowDice && resp.dice_request?.needed) {
        setPendingRoll(resp.dice_request)
        await persist(s)
        setPhase('awaitingRoll')
        return
      }

      // Apply any proposed changes automatically — no confirmation step.
      if (resp.state_updates && resp.state_updates.length > 0) {
        applyStateUpdates(s, resp.state_updates)
        for (let i = s.messages.length - 1; i >= 0; i--) {
          if (s.messages[i].role === 'dm') {
            s.messages[i].stateUpdatesApplied = true
            break
          }
        }
      }

      setPendingRoll(null)
      await persist(s)
      setPhase(s.hp.current <= 0 ? 'defeated' : 'idle')
    },
    [persist],
  )

  const runDMTurn = useCallback(
    async (s: GameSession, history: ChatMessage[], allowDice = true) => {
      lastTurnRef.current = { s, history, allowDice }
      setPhase('thinking')
      setError(null)
      setRetryAfterMs(null)
      try {
        await maybeSummarize(s)
        const resp = await gemini.generateDMTurn(s, history, language)
        await applyDMResponse(s, resp, allowDice)
      } catch (e) {
        showError(e)
        setPhase('idle')
      }
    },
    [gemini, language, maybeSummarize, applyDMResponse, showError],
  )

  // Replay the last DM turn (after a rate-limit / network / server error).
  const retry = useCallback(() => {
    const last = lastTurnRef.current
    if (!last || phase === 'thinking') return
    void runDMTurn(last.s, last.history, last.allowDice)
  }, [phase, runDMTurn])

  // Load the session; kick off an opening scene if brand new.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    ;(async () => {
      const s = await getSession(sessionId)
      if (!s) {
        setPhase('error-loading')
        return
      }
      // Backfill fields added after this session was first saved.
      if (!s.enemies) s.enemies = []
      setSession(s)
      if (s.hp.current <= 0) {
        setPhase('defeated')
        return
      }
      if (s.messages.length === 0) {
        // Opening turn: seed a transient kickoff, persist only the narration.
        // allowDice=false — the player hasn't acted, so never offer a roll here.
        await runDMTurn(
          s,
          [{ role: 'system', content: KICKOFF, timestamp: ts() }],
          false,
        )
      } else {
        setPhase('idle')
      }
    })()
  }, [sessionId, runDMTurn])

  // Player submits a free-text action. Allowed on their turn, and also while a
  // roll is pending — in that case the player is choosing to do something else
  // instead of rolling, so the pending roll is discarded.
  const submitAction = useCallback(
    async (text: string) => {
      if (!session || (phase !== 'idle' && phase !== 'awaitingRoll')) return
      setPendingRoll(null)
      session.messages.push({ role: 'player', content: text, timestamp: ts() })
      setSession({ ...session })
      await runDMTurn(session, historyForModel(session))
    },
    [session, phase, runDMTurn],
  )

  // Player rolls the requested die.
  const roll = useCallback(async (): Promise<DiceResult | null> => {
    if (!session || !pendingRoll || phase !== 'awaitingRoll') return null
    const result = resolveRoll(pendingRoll.ability, session.stats, pendingRoll.dc)
    const outcome = result.isNaturalTwenty
      ? 'critical success'
      : result.isNaturalOne
        ? 'critical failure'
        : result.success
          ? 'success'
          : 'failure'
    session.messages.push({
      role: 'system',
      content: `Dice roll — ${pendingRoll.ability} check: d20=${result.roll}, modifier=${result.modifier}, total=${result.total} vs DC ${result.dc}. Result: ${outcome}.`,
      timestamp: ts(),
      diceResult: result,
    })
    setPendingRoll(null)
    setSession({ ...session })
    await runDMTurn(session, historyForModel(session))
    return result
  }, [session, pendingRoll, phase, runDMTurn])

  return {
    session,
    phase,
    pendingRoll,
    error,
    retryAfterMs,
    retry,
    submitAction,
    roll,
  }
}
