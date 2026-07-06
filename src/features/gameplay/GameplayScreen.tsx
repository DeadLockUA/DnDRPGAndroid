import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../app/AppContext'
import type { Navigate } from '../../app/routes'
import type { ChatMessage } from '../../api/types'
import { useGameplay } from './useGameplay'
import EnemyPanel from './EnemyPanel'
import DebugPanel from './DebugPanel'
import { useTypewriter } from '../../ui/useTypewriter'
import { RetryBanner } from '../../ui/RetryBanner'
import { abilityModifiers, ABILITIES, formatModifier } from '../../db/models'
import '../../ui/chat.css'
import './gameplay.css'

export default function GameplayScreen({
  sessionId,
  navigate,
}: {
  sessionId: string
  navigate: Navigate
}) {
  const { t } = useApp()
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
  const [showModal, setShowModal] = useState<'abilities' | 'inventory' | 'enemies' | null>(null)
  const [showAllMessages, setShowAllMessages] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const MESSAGES_TO_SHOW = 2

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

  const visibleMessages = showAllMessages
    ? session.messages
    : session.messages.slice(-MESSAGES_TO_SHOW)

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
      <div className="chat-shell play-chat">
        <div className="chat-topbar">
          <h2>{session.characterName}</h2>
          <div className="row">
            <button
              className="btn-ghost"
              title={t.play.abilities}
              onClick={() => setShowModal('abilities')}
            >
              ⚔️
            </button>
            <button
              className="btn-ghost"
              title={t.play.inventory}
              onClick={() => setShowModal('inventory')}
            >
              🎒
            </button>
            <button
              className="btn-ghost"
              title={t.play.enemies}
              onClick={() => setShowModal('enemies')}
            >
              👹
            </button>
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
          {!showAllMessages && session.messages.length > MESSAGES_TO_SHOW && (
            <button
              className="show-more-btn"
              onClick={() => setShowAllMessages(true)}
            >
              ↑ {t.play.more} ({session.messages.length - MESSAGES_TO_SHOW})
            </button>
          )}

          {visibleMessages.map((m, i) => {
            const actualIndex = showAllMessages ? session.messages.indexOf(m) : session.messages.length - MESSAGES_TO_SHOW + i
            return (
              <MessageBubble
                key={i}
                message={m}
                isLatestDm={actualIndex === lastDmIndex && phase !== 'loading'}
              />
            )
          })}

          {phase === 'thinking' && (
            <div className="bubble-thinking" role="status" aria-live="polite">
              <span className="spinner" />
              {t.play.dmThinking}
            </div>
          )}

          {phase === 'awaitingRoll' && pendingRoll && (
            <div className="turn-panel">
              <div className="dice-line">{t.play.rollNeeded}</div>
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

      {showModal === 'abilities' && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="modal-content modal-abilities" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowModal(null)}
              aria-label="Close"
            >
              ✕
            </button>
            <div className="char-sheet">
              <h3 className="sheet-title">{session.characterName}</h3>

              <div className="sheet-row">
                <span className="sheet-label">{t.play.hp}</span>
                <div className="sheet-value-with-bar">
                  <span className="sheet-value">{session.hp.current} / {session.hp.max}</span>
                  <div className="stat-bar">
                    <div className="stat-bar-fill" style={{ width: `${Math.max(0, (session.hp.current / session.hp.max) * 100)}%` }} />
                  </div>
                </div>
              </div>

              <div className="abilities-section">
                <div className="abilities-grid">
                  {ABILITIES.map((a) => {
                    const mods = abilityModifiers(session.stats)
                    const pct = Math.max(0, ((session.stats[a] - 3) / 15) * 100)
                    return (
                      <div key={a} className="ability-row">
                        <span className="ability-label">{a.toUpperCase()}</span>
                        <span className="ability-score">{session.stats[a]}</span>
                        <div className="stat-bar">
                          <div className="stat-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="ability-mod">{formatModifier(mods[a])}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal === 'inventory' && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="modal-content modal-inventory" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowModal(null)}
              aria-label="Close"
            >
              ✕
            </button>
            <h3>{t.play.inventory}</h3>
            {session.inventory.length === 0 ? (
              <p className="dim">{t.play.empty}</p>
            ) : (
              <ul className="item-list">
                {session.inventory.map((i) => (
                  <li key={i.name} title={i.description}>
                    <span>{i.name}</span>
                    <span className="qty">×{i.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {showModal === 'enemies' && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="modal-content modal-enemies" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowModal(null)}
              aria-label="Close"
            >
              ✕
            </button>
            <h3>{t.play.enemies}</h3>
            <div className="statuses-section">
              <h4>{t.play.statuses}</h4>
              {session.statuses.length === 0 ? (
                <p className="dim">{t.play.none}</p>
              ) : (
                <ul className="item-list">
                  {session.statuses.map((s) => (
                    <li key={s.name} title={s.description}>
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <EnemyPanel enemies={session.enemies ?? []} t={t} />
    </div>
  )
}

function MessageBubble({
  message,
  isLatestDm,
}: {
  message: ChatMessage
  isLatestDm: boolean
}) {
  const isDm = message.role === 'dm'
  const { shown } = useTypewriter(message.content, isDm && isLatestDm)

  if (message.role === 'system' && message.diceResult) {
    // Dice result is hidden from player; only the DM narration reveals the outcome.
    return null
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
