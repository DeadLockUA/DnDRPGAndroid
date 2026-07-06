import { describe, it, expect } from 'vitest'
import { classifyGeminiError } from '../error-handler'
import { GeminiError } from '../types'

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
})
