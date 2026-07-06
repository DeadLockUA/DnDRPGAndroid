import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../app/AppContext'
import type { Navigate } from '../../app/routes'
import type { ChatMessage, CharacterSheet } from '../../api/types'
import { GeminiError } from '../../api/types'
import { createSession } from '../../db/game-session'
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
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, thinking])

  function showError(e: unknown) {
    const code = e instanceof GeminiError ? e.code : 'UNKNOWN'
    setError(t.errors[code])
  }

  async function send() {
    const text = input.trim()
    if (!text || thinking) return
    setError(null)
    const next: ChatMessage[] = [
      ...messages,
      { role: 'player', content: text, timestamp: now() },
    ]
    setMessages(next)
    setInput('')
    setThinking(true)
    try {
      const reply = await gemini.generateCreationReply(next, language)
      setMessages([...next, { role: 'dm', content: reply, timestamp: now() }])
    } catch (e) {
      showError(e)
    } finally {
      setThinking(false)
    }
  }

  async function finish() {
    if (finishing || thinking) return
    setError(null)
    setFinishing(true)
    try {
      const sheet: CharacterSheet = await gemini.extractCharacterSheet(
        messages,
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
        messages: [],
        summary: '',
      })
      navigate({ screen: 'play', sessionId: session.id })
    } catch (e) {
      showError(e)
      setFinishing(false)
    }
  }

  const canFinish =
    !finishing && !thinking && messages.some((m) => m.role === 'player')

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
        {thinking && <div className="bubble-thinking">{t.creation.thinking}</div>}
        {finishing && (
          <div className="bubble-thinking">{t.creation.building}</div>
        )}
        {error && <div className="banner banner-error">{error}</div>}
      </div>

      <div className="chat-input">
        <textarea
          value={input}
          placeholder={t.creation.placeholder}
          disabled={finishing}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <div className="stack">
          <button
            className="btn-primary"
            onClick={send}
            disabled={thinking || finishing || !input.trim()}
          >
            {t.creation.send}
          </button>
          <button className="btn-ghost" onClick={finish} disabled={!canFinish}>
            {t.creation.finish}
          </button>
        </div>
      </div>
    </div>
  )
}
