import { describe, expect, it } from 'vitest'
import { config } from './proxy'

describe('proxy matcher', () => {
  it('keeps the static Olympia widget demo outside the nonce-based CSP proxy', () => {
    const matcher = new RegExp(config.matcher[0])

    expect(matcher.test('/olympia.html')).toBe(false)
    expect(matcher.test('/api/chat/example-tenant')).toBe(true)
    expect(matcher.test('/backstage')).toBe(true)
  })
})
