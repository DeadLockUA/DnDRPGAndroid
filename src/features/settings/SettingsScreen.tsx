import { useState } from 'react'
import { useApp } from '../../app/AppContext'
import type { Navigate } from '../../app/routes'
import type { Language } from '../../api/types'
import { GeminiError } from '../../api/types'
import { GeminiClient } from '../../api/gemini-client'
import { AVAILABLE_MODELS } from '../../db/models'
import { LANGUAGE_NAMES } from '../../i18n'

type TestState = 'idle' | 'testing' | 'ok' | 'error'

export default function SettingsScreen({ navigate }: { navigate: Navigate }) {
  const { settings, t, updateSettings } = useApp()
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [language, setLanguage] = useState<Language>(settings.language)
  const [model, setModel] = useState(settings.geminiModel)
  const [test, setTest] = useState<TestState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  async function handleSave() {
    await updateSettings({ apiKey: apiKey.trim(), language, geminiModel: model })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  async function handleTest() {
    setError(null)
    setTest('testing')
    try {
      const client = new GeminiClient({
        apiKey: apiKey.trim(),
        language,
        geminiModel: model,
      })
      await client.validateApiKey()
      setTest('ok')
      setTimeout(() => setTest('idle'), 2500)
    } catch (e) {
      setTest('error')
      const code = e instanceof GeminiError ? e.code : 'UNKNOWN'
      setError(t.errors[code])
    }
  }

  return (
    <div className="page">
      <div className="topbar">
        <h1>{t.settings.title}</h1>
        <button className="btn-ghost" onClick={() => navigate({ screen: 'sessions' })}>
          {t.nav.back}
        </button>
      </div>

      {error && <div className="banner banner-error">{error}</div>}
      {test === 'ok' && <div className="banner banner-success">{t.settings.testOk}</div>}

      <div className="card stack">
        <div className="field" style={{ margin: 0 }}>
          <label>{t.settings.apiKeyLabel}</label>
          <input
            type="password"
            value={apiKey}
            placeholder={t.settings.apiKeyPlaceholder}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
          <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
            <span className="hint">{t.settings.getKeyHint}</span>
            <button onClick={handleTest} disabled={test === 'testing' || !apiKey.trim()}>
              {test === 'testing' ? (
                <>
                  <span className="spinner" />
                  {t.settings.testing}
                </>
              ) : (
                t.settings.test
              )}
            </button>
          </div>
        </div>

        <div className="field" style={{ margin: 0 }}>
          <label>{t.settings.languageLabel}</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            {(Object.keys(LANGUAGE_NAMES) as Language[]).map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_NAMES[l]}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ margin: 0 }}>
          <label>{t.settings.modelLabel}</label>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {AVAILABLE_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <p className="hint">{t.settings.privacyNote}</p>

        <button className="btn-primary" onClick={handleSave}>
          {savedFlash ? t.settings.saved : t.settings.save}
        </button>
      </div>
    </div>
  )
}
