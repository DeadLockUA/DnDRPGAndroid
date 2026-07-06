import type { GameSession } from '../../api/types'
import { abilityModifiers, formatModifier, ABILITIES } from '../../db/models'
import type { Dictionary } from '../../i18n'
import { abilityName } from '../../i18n'
import type { Language } from '../../api/types'
import './character-panel.css'

export default function CharacterPanel({
  session,
  t,
  language,
}: {
  session: GameSession
  t: Dictionary
  language: Language
}) {
  const mods = abilityModifiers(session.stats)
  const hpPct = session.hp.max
    ? Math.max(0, (session.hp.current / session.hp.max) * 100)
    : 0

  return (
    <aside className="char-panel">
      <div className="char-name">
        <h3>{session.characterName}</h3>
        <span className="archetype">{session.archetype}</span>
      </div>

      <div className="char-block">
        <div className="hp-label">
          <span>{t.play.hp}</span>
          <span>
            {session.hp.current} / {session.hp.max}
          </span>
        </div>
        <div className="hp-bar">
          <div className="hp-fill" style={{ width: `${hpPct}%` }} />
        </div>
      </div>

      <div className="char-block">
        <h4>{t.play.abilities}</h4>
        <div className="ability-grid">
          {ABILITIES.map((a) => (
            <div key={a} className="ability" title={abilityName(a, language)}>
              <span className="ability-key">{a.toUpperCase()}</span>
              <span className="ability-score">{session.stats[a]}</span>
              <span className="ability-mod">{formatModifier(mods[a])}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="char-block">
        <h4>{t.play.inventory}</h4>
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

      <div className="char-block">
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
    </aside>
  )
}
