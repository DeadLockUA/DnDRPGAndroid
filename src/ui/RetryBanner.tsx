import { useEffect, useRef, useState } from 'react'
import { interpolate, type Dictionary } from '../i18n'

/**
 * Error banner with recovery. On a rate-limited turn (retryAfterMs set) it
 * counts down and auto-fires onRetry at zero; otherwise it shows a manual
 * Retry button. Each new error remounts this component with fresh state,
 * so the timer never leaks between failures.
 */
export function RetryBanner({
  code,
  retryAfterMs,
  onRetry,
  t,
}: {
  code: string
  retryAfterMs: number | null
  onRetry: () => void
  t: Dictionary
}) {
  const initial = retryAfterMs ? Math.max(1, Math.ceil(retryAfterMs / 1000)) : 0
  const [remaining, setRemaining] = useState(initial)

  // Keep the latest callback without resetting the countdown when it changes.
  const onRetryRef = useRef(onRetry)
  useEffect(() => {
    onRetryRef.current = onRetry
  })

  useEffect(() => {
    if (!retryAfterMs) return
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id)
          onRetryRef.current()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [retryAfterMs])

  const message = t.errors[code as keyof typeof t.errors] ?? t.errors.UNKNOWN
  const counting = !!retryAfterMs && remaining > 0

  return (
    <div className="banner banner-error retry-banner" role="alert">
      <span>{message}</span>
      <div className="retry-actions">
        {counting && (
          <span className="retry-count">
            {interpolate(t.errors.retryIn, { sec: remaining })}
          </span>
        )}
        <button className="btn-ghost" onClick={() => onRetryRef.current()}>
          {t.errors.retry}
        </button>
      </div>
    </div>
  )
}
