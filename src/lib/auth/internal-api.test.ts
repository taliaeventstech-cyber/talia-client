import { afterEach, describe, expect, it, vi } from 'vitest'
import { authorizeInternalApiRequest } from './internal-api'

const INTERNAL_KEY = 'internal-key-with-at-least-32-characters'

describe('authorizeInternalApiRequest', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('accepts the configured internal key', () => {
    vi.stubEnv('INTERNAL_API_KEY', INTERNAL_KEY)
    expect(authorizeInternalApiRequest(INTERNAL_KEY)).toEqual({ ok: true })
  })

  it('rejects a missing or incorrect key', () => {
    vi.stubEnv('INTERNAL_API_KEY', INTERNAL_KEY)
    expect(authorizeInternalApiRequest(null)).toMatchObject({ ok: false, status: 401 })
    expect(authorizeInternalApiRequest(`${INTERNAL_KEY}-wrong`)).toMatchObject({ ok: false, status: 401 })
  })

  it('fails closed when the server secret is missing or too short', () => {
    vi.stubEnv('INTERNAL_API_KEY', '')
    expect(authorizeInternalApiRequest(null)).toMatchObject({ ok: false, status: 503 })

    vi.stubEnv('INTERNAL_API_KEY', 'too-short')
    expect(authorizeInternalApiRequest('too-short')).toMatchObject({ ok: false, status: 503 })
  })
})
