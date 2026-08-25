import { describe, expect, it } from 'vitest'
import { getSupabaseCookieOptions } from './cookie-options'

describe('getSupabaseCookieOptions', () => {
  it('marks authentication cookies as Secure in production', () => {
    expect(getSupabaseCookieOptions('production')).toEqual({
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: true,
    })
  })

  it('allows local HTTP development without weakening production cookies', () => {
    expect(getSupabaseCookieOptions('development')).toEqual({
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: false,
    })
  })
})
