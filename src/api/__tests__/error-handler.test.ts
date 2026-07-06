import { describe, it, expect } from 'vitest'
import { classifyGeminiError, parseRetryAfterMs } from '../error-handler'
import { GeminiError } from '../types'

// Verbatim 429 payload captured from a real gemini-2.5-flash free-tier run.
const REAL_429 =
  '{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. \\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-2.5-flash\\nPlease retry in 45.287134897s.","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"45s"}]}}'

describe('classifyGeminiError', () => {
  it('passes through an existing GeminiError', () => {
    const e = new GeminiError('NO_KEY', 'no key')
    expect(classifyGeminiError(e)).toBe(e)
  })

  it('classifies invalid key', () => {
    expect(classifyGeminiError(new Error('API key not valid')).code).toBe(
      'INVALID_KEY',
    )
  })

  it('classifies rate limit', () => {
    expect(classifyGeminiError(new Error('429 Too Many Requests')).code).toBe(
      'RATE_LIMIT',
    )
    expect(
      classifyGeminiError(new Error('RESOURCE_EXHAUSTED: quota')).code,
    ).toBe('RATE_LIMIT')
  })

  it('classifies network errors', () => {
    expect(classifyGeminiError(new Error('Failed to fetch')).code).toBe(
      'NETWORK',
    )
  })

  it('classifies malformed responses', () => {
    expect(
      classifyGeminiError(new Error('Unexpected token < in JSON')).code,
    ).toBe('MALFORMED_RESPONSE')
  })

  it('falls back to UNKNOWN', () => {
    expect(classifyGeminiError(new Error('boom')).code).toBe('UNKNOWN')
    expect(classifyGeminiError('weird string').code).toBe('UNKNOWN')
  })

  it('classifies the real 429 payload and extracts retryAfterMs', () => {
    const e = classifyGeminiError(new Error(REAL_429))
    expect(e.code).toBe('RATE_LIMIT')
    // "Please retry in 45.287134897s" → ~45287ms
    expect(e.retryAfterMs).toBeGreaterThanOrEqual(45000)
    expect(e.retryAfterMs).toBeLessThan(46000)
  })

  it('leaves retryAfterMs undefined when no delay is present', () => {
    const e = classifyGeminiError(new Error('429 Too Many Requests'))
    expect(e.code).toBe('RATE_LIMIT')
    expect(e.retryAfterMs).toBeUndefined()
  })
})

describe('parseRetryAfterMs', () => {
  it('parses the precise "retry in N.NNNs" form', () => {
    expect(parseRetryAfterMs('Please retry in 45.287134897s.')).toBe(45287)
  })

  it('parses the structured retryDelay field', () => {
    expect(parseRetryAfterMs('..."retryDelay":"30s"...')).toBe(30000)
  })

  it('parses an integer seconds delay', () => {
    expect(parseRetryAfterMs('retry in 12s')).toBe(12000)
  })

  it('returns undefined when there is no delay', () => {
    expect(parseRetryAfterMs('some unrelated error')).toBeUndefined()
  })
})
