import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyMetaWebhookChallenge, verifyMetaWebhookSignature } from './webhook-security'

describe('Meta webhook security', () => {
  it('returns a challenge only for a timing-safe token match', () => {
    expect(verifyMetaWebhookChallenge({
      mode: 'subscribe',
      token: 'expected-token',
      challenge: '123456',
      expectedToken: 'expected-token',
    })).toBe('123456')
    expect(verifyMetaWebhookChallenge({
      mode: 'subscribe',
      token: 'wrong-token',
      challenge: '123456',
      expectedToken: 'expected-token',
    })).toBeNull()
  })

  it('validates the signature against the unmodified request body', () => {
    const payload = JSON.stringify({ text: 'Bon dia, món' })
    const appSecret = 'instagram-app-secret'
    const signature = `sha256=${createHmac('sha256', appSecret).update(payload).digest('hex')}`

    expect(verifyMetaWebhookSignature({ payload, signature, appSecret })).toBe(true)
    expect(verifyMetaWebhookSignature({ payload: `${payload} `, signature, appSecret })).toBe(false)
    expect(verifyMetaWebhookSignature({ payload, signature: null, appSecret })).toBe(false)
  })
})
