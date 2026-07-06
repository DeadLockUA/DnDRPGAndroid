import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../app/AppContext'
import type { Navigate } from '../../app/routes'
import type { ChatMessage } from '../../api/types'
import { useGameplay } from './useGameplay'
import CharacterPanel from './CharacterPanel'
import EnemyPanel from './EnemyPanel'
import DebugPanel from './DebugPanel'
import { useTypewriter } from '../../ui/useTypewriter'
import { RetryBanner } from '../../ui/RetryBanner'
import { abilityName, interpolate, type Dictionary } from '../../i18n'
import { formatModifier } from '../../db/models'
import type { Language } from '../../api/types'
import '../../ui/chat.css'
import './gameplay.css'

export default function GameplayScreen({
  sessionId,
  navigate,
}: {
  sessionId: string
  navigate: Navigate
}) {
  const { t, language } = useApp()
  const {
    session,
    phase,
    pendingRoll,
    error,
    retryAfterMs,
    retry,
    submitAction,
    roll,
  } = useGameplay(sessionId)

  const [input, setInput] = useState('')
  const [showDebug, setShowDebug] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [session?.messages.length, phase, pendingRoll])

  // Return focus to the action box when it's the player's turn again.
  useEffect(() => {
    if (phase === 'idle') inputRef.current?.focus()
  }, [phase])

  if (phase === 'error-loading') {
    return (
      <div className="center-screen">
        <div className="stack" style={{ alignItems: 'center' }}>
          <p>{t.errors.UNKNOWN}</p>
          <button className="btn-primary" onClick={() => navigate({ screen: 'sessions' })}>
            {t.nav.home}
          </button>
        </div>
      </div>
    )
  }

  if (!session) {
    return <div className="center-screen">{t.loading}</div>
  }

  const lastDmIndex = (() => {
    for (let i = session.messages.length - 1; i >= 0; i--) {
      if (session.messages[i].role === 'dm') return i
    }
    return -1
  })()

  function handleSend() {
    const text = input.trim()
    if (!text) return
    setInput('')
    submitAction(text)
  }

  return (
    <div className="play-layout">
      <CharacterPanel session={session} t={t} language={language} />

      <div className="chat-shell play-chat">
        <div className="chat-topbar">
          <h2>{session.characterName}</h2>
          <div className="row">
            <button
              className="btn-ghost"
              aria-pressed={showDebug}
              onClick={() => setShowDebug((v) => !v)}
              title={t.play.debug}
            >
              🐞
            </button>
            <button className="btn-ghost" onClick={() => navigate({ screen: 'sessions' })}>
              {t.play.quit}
            </button>
          </div>
        </div>

        <div className="chat-scroll" ref={scrollRef}>
          {session.messages.map((m, i) => (
            <MessageBubble
              key={i}
              message={m}
              isLatestDm={i === lastDmIndex && phase !== 'loading'}
              t={t}
              language={language}
            />
          ))}

          {phase === 'thinking' && (
            <div className="bubble-thinking" role="status" aria-live="polite">
              <span className="spinner" />
              {t.play.dmThinking}
            </div>
          )}

          {phase === 'awaitingRoll' && pendingRoll && (
            <div className="turn-panel">
              <div className="dice-line">
                {interpolate(t.play.rollPrompt, {
                  ability: abilityName(pendingRoll.ability, language),
                  dc: pendingRoll.dc,
                })}
                {pendingRoll.reason ? ` — ${pendingRoll.reason}` : ''}
              </div>
              <div className="panel-actions">
                <button className="btn-primary" onClick={() => roll()}>
                  🎲 {t.play.roll}
                </button>
              </div>
              <span className="hint">{t.play.orActInstead}</span>
            </div>
          )}

          {phase === 'defeated' && (
            <div className="turn-panel defeated-panel" role="status">
              <div className="defeated-text">{t.play.defeated}</div>
              <div className="panel-actions">
                <button
                  className="btn-primary"
                  onClick={() => navigate({ screen: 'creation' })}
                >
                  ✦ {t.sessions.newGame}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => navigate({ screen: 'sessions' })}
                >
                  {t.nav.home}
                </button>
              </div>
            </div>
          )}

          {error && (
            <RetryBanner
              code={error}
              retryAfterMs={retryAfterMs}
              onRetry={retry}
              t={t}
            />
          )}
        </div>

        <div className="chat-input">
          <textarea
            ref={inputRef}
            value={input}
            placeholder={t.play.actionPlaceholder}
            disabled={phase !== 'idle' && phase !== 'awaitingRoll'}
            aria-label={t.play.actionPlaceholder}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <button
            className="btn-primary"
            onClick={handleSend}
            disabled={
              (phase !== 'idle' && phase !== 'awaitingRoll') || !input.trim()
            }
          >
            {t.play.send}
          </button>
        </div>

        {showDebug && <DebugPanel onClose={() => setShowDebug(false)} t={t} />}
      </div>

      <EnemyPanel enemies={session.enemies ?? []} t={t} />
    </div>
  )
}

function MessageBubble({
  message,
  isLatestDm,
  t,
  language,
}: {
  message: ChatMessage
  isLatestDm: boolean
  t: Dictionary
  language: Language
}) {
  const isDm = message.role === 'dm'
  const { shown } = useTypewriter(message.content, isDm && isLatestDm)

  if (message.role === 'system' && message.diceResult) {
    const d = message.diceResult
    const cls = d.isNaturalTwenty
      ? 'crit-success'
      : d.isNaturalOne
        ? 'crit-fail'
        : d.success
          ? 'is-success'
          : 'is-failure'
    const label = d.isNaturalTwenty
      ? t.play.critSuccess
      : d.isNaturalOne
        ? t.play.critFail
        : d.success
          ? t.play.success
          : t.play.failure
    return (
      <div className="bubble bubble-system dice-result">
        🎲 {abilityName(d.ability, language)}:{' '}
        {interpolate(t.play.youRolled, {
          roll: d.roll,
          mod: formatModifier(d.modifier),
          total: d.total,
          dc: d.dc,
        })}
        <div className={`dice-outcome ${cls}`}>{label}</div>
      </div>
    )
  }

  if (message.role === 'system') {
    // Internal system prompts (reject/kickoff) aren't shown to the player.
    return null
  }

  return (
    <div className={`bubble bubble-${message.role}`}>
      {isDm && isLatestDm ? shown : message.content}
    </div>
  )
}
