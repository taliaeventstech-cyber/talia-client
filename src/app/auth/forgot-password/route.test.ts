// @vitest-environment node

import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const resetPasswordForEmail = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { resetPasswordForEmail },
  }),
}))

vi.mock('@/lib/auth/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/security')>()
  return {
    ...actual,
    checkRateLimit: () => null,
    getClientIp: () => '127.0.0.1',
  }
})

import { POST } from './route'

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
  resetPasswordForEmail.mockReset()
})

describe('POST /auth/forgot-password', () => {
  it('passes the initiating local origin to Supabase recovery', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://agora.talia.events'
    resetPasswordForEmail.mockResolvedValue({ error: null })

    const response = await POST(new NextRequest('http://localhost:3000/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(200)
    expect(resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'http://localhost:3000/auth/reset-callback',
    })
  })

  it('keeps the neutral response when Supabase rejects delivery', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: new Error('provider failure') })

    const response = await POST(new NextRequest('http://localhost:3000/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com' }),
      headers: { 'content-type': 'application/json' },
    }))

    await expect(response.json()).resolves.toEqual({ ok: true })
  })
})
