// @vitest-environment node

import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const exchangeCodeForSession = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession },
  }),
}))

import { GET } from './route'

afterEach(() => {
  exchangeCodeForSession.mockReset()
})

describe('GET /auth/reset-callback', () => {
  it('exchanges the recovery code and stays on the callback origin', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })

    const response = await GET(new NextRequest('http://localhost:3000/auth/reset-callback?code=recovery-code'))

    expect(exchangeCodeForSession).toHaveBeenCalledWith('recovery-code')
    expect(response.headers.get('location')).toBe('http://localhost:3000/reset-password')
  })

  it('returns invalid links to the local recovery screen', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('expired') })

    const response = await GET(new NextRequest('http://localhost:3000/auth/reset-callback?code=expired-code'))

    expect(response.headers.get('location'))
      .toBe('http://localhost:3000/forgot-password?error=recovery_link_invalid')
  })
})
