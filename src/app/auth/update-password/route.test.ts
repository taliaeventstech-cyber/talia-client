// @vitest-environment node

import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { getUser, updateUser, signOut, getPostAuthRedirectPath } = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  getPostAuthRedirectPath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser, updateUser, signOut },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ auth: {} }),
}))

vi.mock('@/lib/auth/post-auth-redirect', () => ({
  getPostAuthRedirectPath,
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

function request(password = 'StrongPassword123') {
  return new NextRequest('https://agora.talia.events/auth/update-password', {
    method: 'POST',
    body: JSON.stringify({ password }),
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  getUser.mockReset()
  updateUser.mockReset()
  signOut.mockReset()
  getPostAuthRedirectPath.mockReset()
})

describe('POST /auth/update-password', () => {
  it('invalidates every other session after changing the password', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    updateUser.mockResolvedValue({ error: null })
    signOut.mockResolvedValue({ error: null })
    getPostAuthRedirectPath.mockResolvedValue('/venue/overview')

    const response = await POST(request())

    expect(updateUser).toHaveBeenCalledWith({ password: 'StrongPassword123' })
    expect(signOut).toHaveBeenCalledWith({ scope: 'others' })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ redirectTo: '/venue/overview' })
  })

  it('does not invalidate sessions when the password change fails', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    updateUser.mockResolvedValue({ error: new Error('provider failure') })

    const response = await POST(request())

    expect(signOut).not.toHaveBeenCalled()
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'update_failed' })
  })

  it('fails closed when other sessions cannot be invalidated', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    updateUser.mockResolvedValue({ error: null })
    signOut.mockResolvedValue({ error: new Error('revocation failed') })

    const response = await POST(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'session_invalidation_failed' })
    expect(getPostAuthRedirectPath).not.toHaveBeenCalled()
  })
})
