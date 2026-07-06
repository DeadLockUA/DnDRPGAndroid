import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../app/AppContext'
import type { Navigate } from '../../app/routes'
import type { ChatMessage } from '../../api/types'
import { useGameplay } from './useGameplay'
import CharacterPanel from './CharacterPanel'
import { describeStateUpdate } from './state-updates'
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
    pendingUpdates,
    error,
    retryAfterMs,
    retry,
    submitAction,
    roll,
    accept,
    reject,
    other,
  } = useGameplay(sessionId)

  const [input, setInput] = useState('')
  const [otherMode, setOtherMode] = useState(false)
  const [otherText, setOtherText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [session?.messages.length, phase, pendingUpdates, pendingRoll])

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

  function handleOther() {
    const text = otherText.trim()
    if (!text) return
    setOtherText('')
    setOtherMode(false)
    other(text)
  }

  return (
    <div className="play-layout">
      <CharacterPanel session={session} t={t} language={language} />

      <div className="chat-shell play-chat">
        <div className="chat-topbar">
          <h2>{session.characterName}</h2>
          <button className="btn-ghost" onClick={() => navigate({ screen: 'sessions' })}>
            {t.play.quit}
          </button>
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
            <div className="bubble-thinking">
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
            </div>
          )}

          {phase === 'awaitingConfirm' && pendingUpdates && (
            <div className="turn-panel">
              <strong>{t.play.proposedChanges}</strong>
              <ul className="updates-list">
                {pendingUpdates.map((u, i) => (
                  <li key={i}>
                    <span>{describeStateUpdate(u)}</span>
                    <span className="reason">{u.reason}</span>
                  </li>
                ))}
              </ul>
              {otherMode ? (
                <div className="stack">
                  <textarea
                    value={otherText}
                    placeholder={t.play.otherPlaceholder}
                    onChange={(e) => setOtherText(e.target.value)}
                    autoFocus
                  />
                  <div className="panel-actions">
                    <button className="btn-primary" onClick={handleOther} disabled={!otherText.trim()}>
                      {t.play.submit}
                    </button>
                    <button className="btn-ghost" onClick={() => setOtherMode(false)}>
                      {t.play.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="panel-actions">
                  <button className="btn-primary" onClick={accept}>
                    ✓ {t.play.accept}
                  </button>
                  <button className="btn-ghost" onClick={reject}>
                    ✗ {t.play.reject}
                  </button>
                  <button className="btn-ghost" onClick={() => setOtherMode(true)}>
                    {t.play.other}
                  </button>
                </div>
              )}
            </div>
          )}

          {phase === 'defeated' && (
            <div className="bubble bubble-system defeated">{t.play.defeated}</div>
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
            value={input}
            placeholder={t.play.actionPlaceholder}
            disabled={phase !== 'idle'}
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
            disabled={phase !== 'idle' || !input.trim()}
          >
            {t.play.send}
          </button>
        </div>
      </div>
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
