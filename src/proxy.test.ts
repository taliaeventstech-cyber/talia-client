import { describe, expect, it } from 'vitest'
import { config } from './proxy'
import {
  applyPrivateNoStoreHeaders,
  isAuthenticationPath,
} from './lib/security/cache-control'

describe('proxy matcher', () => {
  it('keeps the static Olympia widget demo outside the nonce-based CSP proxy', () => {
    const matcher = new RegExp(config.matcher[0])

    expect(matcher.test('/olympia.html')).toBe(false)
    expect(matcher.test('/api/chat/example-tenant')).toBe(true)
    expect(matcher.test('/backstage')).toBe(true)
  })
})

describe('authentication response cache policy', () => {
  it('recognizes every authentication endpoint without matching unrelated paths', () => {
    expect(isAuthenticationPath('/auth')).toBe(true)
    expect(isAuthenticationPath('/auth/login')).toBe(true)
    expect(isAuthenticationPath('/auth/reset-callback')).toBe(true)
    expect(isAuthenticationPath('/api/auth/login')).toBe(false)
    expect(isAuthenticationPath('/login')).toBe(false)
  })

  it('prevents authentication responses from being stored by browsers or shared caches', () => {
    const headers = new Headers({ 'Cache-Control': 'public, max-age=0, must-revalidate' })

    applyPrivateNoStoreHeaders(headers)

    expect(headers.get('Cache-Control')).toBe('no-store, max-age=0')
    expect(headers.get('Pragma')).toBe('no-cache')
    expect(headers.get('Expires')).toBe('0')
  })
})
