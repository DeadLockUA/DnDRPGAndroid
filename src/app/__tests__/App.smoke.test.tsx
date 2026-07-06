import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import App from '../App'
import { _resetDBHandle } from '../../db'

beforeEach(() => {
  _resetDBHandle()
  ;(globalThis as unknown as { indexedDB: IDBFactory }).indexedDB =
    new IDBFactory()
})

describe('App smoke test', () => {
  it('boots to the session list with no key configured', async () => {
    render(<App />)

    // Resolves past the loading state to the session list.
    await waitFor(() =>
      expect(screen.getByText('Your Adventures')).toBeDefined(),
    )

    // With no API key, the "needs key" banner shows and New Adventure is disabled.
    expect(screen.getByText(/Set your Gemini API key/i)).toBeDefined()
    const newGame = screen.getByRole('button', { name: /New Adventure/i })
    expect(newGame.hasAttribute('disabled')).toBe(true)
  })

  it('navigates to settings and back', async () => {
    render(<App />)
    await waitFor(() =>
      expect(screen.getByText('Your Adventures')).toBeDefined(),
    )

    fireEvent.click(screen.getByRole('button', { name: /Settings/i }))
    await waitFor(() =>
      expect(screen.getByText('Gemini API Key')).toBeDefined(),
    )

    fireEvent.click(screen.getByRole('button', { name: /Back/i }))
    await waitFor(() =>
      expect(screen.getByText('Your Adventures')).toBeDefined(),
    )
  })
})
