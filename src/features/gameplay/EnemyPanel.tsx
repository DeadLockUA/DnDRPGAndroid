import type { Enemy } from '../../api/types'
import type { Dictionary } from '../../i18n'
import './enemy-panel.css'

export default function EnemyPanel({
  enemies,
  t,
}: {
  enemies: Enemy[]
  t: Dictionary
}) {
  if (!enemies.length) return null

  return (
    <aside className="enemy-panel">
      <h4>{t.play.enemies}</h4>
      <div className="enemy-list">
        {enemies.map((e) => {
          const pct = e.hp.max ? Math.max(0, (e.hp.current / e.hp.max) * 100) : 0
          return (
            <div key={e.name} className="enemy" title={e.description}>
              <div className="enemy-head">
                <span className="enemy-name">{e.name}</span>
                <span className="enemy-hp">
                  {e.hp.current}/{e.hp.max}
                </span>
              </div>
              <div className="enemy-bar">
                <div className="enemy-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
