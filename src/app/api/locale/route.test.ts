import { describe, expect, it } from 'vitest'
import { POST } from './route'

describe('POST /api/locale', () => {
  it('persists Brazilian Portuguese as the interface locale', async () => {
    const response = await POST(new Request('http://localhost/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'pt-BR' }),
    }))

    expect(response.status).toBe(204)
    expect(response.headers.get('set-cookie')).toContain('talia-locale=pt-BR')
  })

  it('rejects unsupported locales', async () => {
    const response = await POST(new Request('http://localhost/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'fr' }),
    }))

    expect(response.status).toBe(400)
  })
})
