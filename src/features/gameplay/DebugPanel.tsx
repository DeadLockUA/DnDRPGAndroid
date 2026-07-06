import { useSyncExternalStore } from 'react'
import {
  subscribeDebug,
  getDebugEntries,
  clearDebug,
} from '../../api/debug-log'
import type { Dictionary } from '../../i18n'
import './debug-panel.css'

export default function DebugPanel({
  onClose,
  t,
}: {
  onClose: () => void
  t: Dictionary
}) {
  const entries = useSyncExternalStore(subscribeDebug, getDebugEntries)

  return (
    <div className="debug-panel">
      <div className="debug-head">
        <strong>🐞 {t.play.debug}</strong>
        <div className="row">
          <button className="btn-ghost" onClick={clearDebug}>
            {t.play.debugClear}
          </button>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className="debug-body">
        {entries.length === 0 ? (
          <p className="hint">{t.play.debugEmpty}</p>
        ) : (
          entries.map((e) => (
            <details key={e.id} className="debug-entry" open={e.id === entries[0].id}>
              <summary>
                <span className="debug-kind">{e.kind}</span>
                <span className="debug-model">{e.model}</span>
                <span className="debug-time">
                  {new Date(e.ts).toLocaleTimeString()}
                </span>
                {e.error && <span className="debug-err-tag">error</span>}
              </summary>

              {e.systemInstruction && (
                <>
                  <div className="debug-label">{t.play.debugSystem}</div>
                  <pre>{e.systemInstruction}</pre>
                </>
              )}
              <div className="debug-label">{t.play.debugRequest}</div>
              <pre>{e.contents}</pre>
              <div className="debug-label">{t.play.debugResponse}</div>
              <pre className={e.error ? 'debug-err' : ''}>
                {e.error ?? e.response ?? ''}
              </pre>
            </details>
          ))
        )}
      </div>
    </div>
  )
}
