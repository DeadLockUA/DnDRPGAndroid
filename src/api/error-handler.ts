import { GeminiError, type GeminiErrorCode } from './types'

/**
 * Maps an arbitrary thrown value from the Gemini SDK / fetch into a
 * GeminiError with a stable code the UI can localize.
 */
export function classifyGeminiError(error: unknown): GeminiError {
  if (error instanceof GeminiError) return error

  const raw =
    error instanceof Error ? error.message : String(error ?? 'Unknown error')
  const message = raw.toLowerCase()

  const code = classifyCode(message)
  const retryAfterMs =
    code === 'RATE_LIMIT' ? parseRetryAfterMs(raw) : undefined
  return new GeminiError(code, raw, retryAfterMs)
}

/**
 * Extracts a retry delay (in ms) from a Gemini 429 error. Handles both the
 * prose "Please retry in 45.287s" and the structured `"retryDelay":"45s"`
 * forms. Returns undefined when no delay is present.
 */
export function parseRetryAfterMs(text: string): number | undefined {
  const structured = /"?retrydelay"?\s*:?\s*"?(\d+(?:\.\d+)?)s/i.exec(text)
  if (structured) return Math.round(parseFloat(structured[1]) * 1000)

  const prose = /retry\s+in\s+(\d+(?:\.\d+)?)\s*s/i.exec(text)
  if (prose) return Math.round(parseFloat(prose[1]) * 1000)

  return undefined
}

function classifyCode(message: string): GeminiErrorCode {
  if (
    message.includes('api key not valid') ||
    message.includes('api_key_invalid') ||
    message.includes('permission_denied') ||
    message.includes('unauthenticated') ||
    (message.includes('invalid') && message.includes('key')) ||
    message.includes('400')
  ) {
    // 400 from Gemini most commonly means a bad key/request in this app.
    if (message.includes('key') || message.includes('api')) return 'INVALID_KEY'
  }

  if (
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('resource_exhausted') ||
    message.includes('quota') ||
    message.includes('rate limit')
  ) {
    return 'RATE_LIMIT'
  }

  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('econnrefused') ||
    message.includes('timeout')
  ) {
    return 'NETWORK'
  }

  if (
    message.includes('json') ||
    message.includes('schema') ||
    message.includes('unexpected token') ||
    message.includes('malformed') ||
    message.includes('parse')
  ) {
    return 'MALFORMED_RESPONSE'
  }

  if (message.includes('no api key') || message.includes('missing key')) {
    return 'NO_KEY'
  }

  return 'UNKNOWN'
}
