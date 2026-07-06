import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Settings, Language } from '../api/types'
import { getSettings, saveSettings } from '../db/settings'
import { DEFAULT_SETTINGS } from '../db/models'
import { GeminiClient } from '../api/gemini-client'
import { getDictionary, type Dictionary } from '../i18n'

interface AppContextValue {
  ready: boolean
  settings: Settings
  language: Language
  t: Dictionary
  gemini: GeminiClient
  hasKey: boolean
  updateSettings: (next: Settings) => Promise<void>
}

const AppContext = createContext<AppContextValue | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  // A single client instance; kept in sync with settings.
  const gemini = useMemo(() => new GeminiClient(DEFAULT_SETTINGS), [])

  useEffect(() => {
    let cancelled = false
    getSettings()
      .then((loaded) => {
        if (cancelled) return
        setSettings(loaded)
        gemini.updateSettings(loaded)
      })
      .catch((err) => console.error('Failed to load settings', err))
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [gemini])

  async function updateSettings(next: Settings): Promise<void> {
    await saveSettings(next)
    setSettings(next)
    gemini.updateSettings(next)
  }

  const value: AppContextValue = useMemo(
    () => ({
      ready,
      settings,
      language: settings.language,
      t: getDictionary(settings.language),
      gemini,
      hasKey: settings.apiKey.trim().length > 0,
      updateSettings,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, settings, gemini],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
