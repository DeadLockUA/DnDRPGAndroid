import { useEffect, useState } from 'react'
import { useApp } from '../../app/AppContext'
import type { Navigate } from '../../app/routes'
import type { GameSession } from '../../api/types'
import { getAllSessions, deleteSession } from '../../db/game-session'
import './session-list.css'

export default function SessionListScreen({ navigate }: { navigate: Navigate }) {
  const { t, language, hasKey } = useApp()
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    getAllSessions()
      .then(setSessions)
      .catch((e) => setLoadError(String(e?.message ?? e)))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    await deleteSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
    setConfirmId(null)
  }

  const dateFmt = new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="page">
      <div className="topbar">
        <h1>{t.sessions.title}</h1>
        <button className="btn-ghost" onClick={() => navigate({ screen: 'settings' })}>
          ⚙ {t.nav.settings}
        </button>
      </div>

      {!hasKey && <div className="banner banner-error">{t.sessions.needKey}</div>}

      {loadError && (
        <div className="banner banner-error" role="alert">
          {t.errors.UNKNOWN} ({loadError})
        </div>
      )}

      <button
        className="btn-primary new-game"
        disabled={!hasKey}
        onClick={() => navigate({ screen: 'creation' })}
      >
        ✦ {t.sessions.newGame}
      </button>

      {loading ? (
        <p className="hint" style={{ marginTop: 20 }}>
          {t.loading}
        </p>
      ) : sessions.length === 0 ? (
        <div className="card empty-state">{t.sessions.empty}</div>
      ) : (
        <div className="session-grid">
          {sessions.map((s) => (
            <div key={s.id} className="card session-card">
              <div className="session-head">
                <h3>{s.characterName}</h3>
                <span className="archetype">{s.archetype}</span>
              </div>
              <p className="session-back">{s.backstory}</p>
              <div className="session-meta">
                <span>
                  {t.play.hp}: {s.hp.current}/{s.hp.max}
                </span>
                <span>
                  {t.sessions.lastPlayed}: {dateFmt.format(s.lastPlayedAt)}
                </span>
              </div>

              {confirmId === s.id ? (
                <div className="confirm">
                  <span>{t.sessions.confirmDelete}</span>
                  <div className="row">
                    <button className="btn-danger" onClick={() => handleDelete(s.id)}>
                      {t.sessions.yes}
                    </button>
                    <button className="btn-ghost" onClick={() => setConfirmId(null)}>
                      {t.sessions.no}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="row session-actions">
                  <button
                    className="btn-primary"
                    onClick={() => navigate({ screen: 'play', sessionId: s.id })}
                  >
                    {t.sessions.continue}
                  </button>
                  <button className="btn-danger" onClick={() => setConfirmId(s.id)}>
                    {t.sessions.delete}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
