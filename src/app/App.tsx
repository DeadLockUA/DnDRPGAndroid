import { useState } from 'react'
import { AppProvider, useApp } from './AppContext'
import type { Route } from './routes'
import SessionListScreen from '../features/session-list/SessionListScreen'
import SettingsScreen from '../features/settings/SettingsScreen'
import CharacterCreationScreen from '../features/character-creation/CharacterCreationScreen'
import GameplayScreen from '../features/gameplay/GameplayScreen'

function Shell() {
  const { ready, t } = useApp()
  const [route, setRoute] = useState<Route>({ screen: 'sessions' })

  if (!ready) {
    return <div className="center-screen">{t.loading}</div>
  }

  switch (route.screen) {
    case 'sessions':
      return <SessionListScreen navigate={setRoute} />
    case 'settings':
      return <SettingsScreen navigate={setRoute} />
    case 'creation':
      return <CharacterCreationScreen navigate={setRoute} />
    case 'play':
      return <GameplayScreen sessionId={route.sessionId} navigate={setRoute} />
  }
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
