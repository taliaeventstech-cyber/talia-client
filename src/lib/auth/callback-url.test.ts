// @vitest-environment node

import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it } from 'vitest'
import { getAuthCallbackUrl } from './callback-url'

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
})

describe('getAuthCallbackUrl', () => {
  it('uses the production request origin when the configured app URL is localhost', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

    const request = new NextRequest('https://agora.talia.events/auth/signup')

    expect(getAuthCallbackUrl(request)).toBe('https://agora.talia.events/auth/callback')
  })

  it('uses the configured production app URL when it is valid', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://agora.talia.events'

    const request = new NextRequest('https://preview.talia.events/auth/signup')

    expect(getAuthCallbackUrl(request)).toBe('https://agora.talia.events/auth/callback')
  })
})
