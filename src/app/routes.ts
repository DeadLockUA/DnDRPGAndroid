export type Route =
  | { screen: 'sessions' }
  | { screen: 'settings' }
  | { screen: 'creation' }
  | { screen: 'play'; sessionId: string }

export type Navigate = (route: Route) => void
