import { useEffect, useRef, useState } from 'react'

/**
 * Reveals `text` progressively. Returns the visible slice and whether it's done.
 * When `text` changes, the effect restarts. `enabled=false` shows the full text
 * immediately (used for already-seen history messages).
 */
export function useTypewriter(
  text: string,
  enabled: boolean,
  speed = 18,
): { shown: string; done: boolean } {
  const [count, setCount] = useState(enabled ? 0 : text.length)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!enabled) {
      setCount(text.length)
      return
    }
    setCount(0)
    timer.current = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          if (timer.current) clearInterval(timer.current)
          return c
        }
        return c + 1
      })
    }, speed)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [text, enabled, speed])

  return { shown: text.slice(0, count), done: count >= text.length }
}
