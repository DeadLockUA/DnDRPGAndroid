import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../app/AppContext'
import type { Navigate } from '../../app/routes'
import type { ChatMessage, CharacterSheet } from '../../api/types'
import { GeminiError } from '../../api/types'
import { createSession } from '../../db/game-session'
import { RetryBanner } from '../../ui/RetryBanner'
import '../../ui/chat.css'

function now() {
  return Date.now()
}

export default function CharacterCreationScreen({
  navigate,
}: {
  navigate: Navigate
}) {
  const { t, language, gemini } = useApp()
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'dm', content: t.creation.intro, timestamp: now() },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryAfterMs, setRetryAfterMs] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Replays whichever call failed (a reply request or the finish/extract).
  const lastActionRef = useRef<(() => void) | null>(null)
  // Track if we've already auto-fetched the opening greeting.
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, thinking])

  function showError(e: unknown) {
    if (e instanceof GeminiError) {
      setError(e.code)
      setRetryAfterMs(e.retryAfterMs ?? null)
    } else {
      setError('UNKNOWN')
      setRetryAfterMs(null)
    }
  }

  function clearError() {
    setError(null)
    setRetryAfterMs(null)
  }

  const startAdventure = useCallback(
    async (history: ChatMessage[]) => {
      clearError()
      setFinishing(true)
      try {
        const sheet: CharacterSheet = await gemini.extractCharacterSheet(
          history,
          language,
        )
        const maxHp = Math.max(6, Math.round(sheet.maxHp) || 10)
        const session = await createSession({
          characterName: sheet.characterName,
          archetype: sheet.archetype,
          backstory: sheet.backstory,
          stats: sheet.stats,
          hp: { current: maxHp, max: maxHp },
          inventory: sheet.inventory ?? [],
          statuses: [],
          enemies: [],
          messages: [],
          summary: '',
        })
        navigate({ screen: 'play', sessionId: session.id })
      } catch (e) {
        lastActionRef.current = () => void startAdventure(history)
        showError(e)
        setFinishing(false)
      }
    },
    [gemini, language, navigate],
  )

  const requestReply = useCallback(
    async (history: ChatMessage[]) => {
      clearError()
      setThinking(true)
      try {
        const { message, ready } = await gemini.generateCreationReply(
          history,
          language,
        )
        const next: ChatMessage[] = [
          ...history,
          { role: 'dm', content: message, timestamp: now() },
        ]
        setMessages(next)
        setThinking(false)
        // The guide decided the sheet is complete — start the adventure itself.
        if (ready) await startAdventure(next)
      } catch (e) {
        setThinking(false)
        lastActionRef.current = () => void requestReply(history)
        showError(e)
      }
    },
    [gemini, language, startAdventure],
  )

  // Auto-fetch the opening greeting on first load.
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      const initialMessages: ChatMessage[] = [
        { role: 'dm', content: t.creation.intro, timestamp: now() },
      ]
      setMessages(initialMessages)
      // Trigger the opening greeting from the DM without waiting for player input.
      void requestReply(initialMessages)
    }
  }, [requestReply, t.creation.intro])

  async function send() {
    const text = input.trim()
    if (!text || thinking || finishing) return
    const next: ChatMessage[] = [
      ...messages,
      { role: 'player', content: text, timestamp: now() },
    ]
    setMessages(next)
    setInput('')
    await requestReply(next)
  }

  function retry() {
    const action = lastActionRef.current
    if (!action || thinking || finishing) return
    clearError()
    action()
  }

  return (
    <div className="chat-shell">
      <div className="chat-topbar">
        <h2>{t.creation.title}</h2>
        <button
          className="btn-ghost"
          onClick={() => navigate({ screen: 'sessions' })}
        >
          {t.nav.back}
        </button>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble bubble-${m.role}`}>
            {m.content}
          </div>
        ))}
        {thinking && (
          <div className="bubble-thinking" role="status" aria-live="polite">
            {t.creation.thinking}
          </div>
        )}
        {finishing && (
          <div className="bubble-thinking" role="status" aria-live="polite">
            {t.creation.building}
          </div>
        )}
        {error && !thinking && !finishing && (
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
          placeholder={t.creation.placeholder}
          disabled={finishing}
          aria-label={t.creation.placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button
          className="btn-primary"
          onClick={send}
          disabled={thinking || finishing || !input.trim()}
        >
          {t.creation.send}
        </button>
      </div>
    </div>
  )
}
