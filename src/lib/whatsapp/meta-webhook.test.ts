import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  parseMetaWebhookEnvelope,
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
} from './meta-webhook'

describe('Meta WhatsApp webhook', () => {
  it('returns the challenge only for a valid subscription token', () => {
    expect(verifyMetaWebhookChallenge({
      mode: 'subscribe',
      token: 'expected-token',
      challenge: 'challenge-value',
      expectedToken: 'expected-token',
    })).toBe('challenge-value')

    expect(verifyMetaWebhookChallenge({
      mode: 'subscribe',
      token: 'wrong-token',
      challenge: 'challenge-value',
      expectedToken: 'expected-token',
    })).toBeNull()
  })

  it('validates the sha256 signature against the unmodified payload', () => {
    const payload = JSON.stringify({ message: 'Bon dia, món' })
    const appSecret = 'app-secret'
    const signature = `sha256=${createHmac('sha256', appSecret).update(payload).digest('hex')}`

    expect(verifyMetaWebhookSignature({ payload, signature, appSecret })).toBe(true)
    expect(verifyMetaWebhookSignature({ payload: `${payload} `, signature, appSecret })).toBe(false)
    expect(verifyMetaWebhookSignature({ payload, signature: 'invalid', appSecret })).toBe(false)
  })

  it('accepts a WhatsApp envelope while preserving provider extensions', () => {
    const envelope = parseMetaWebhookEnvelope(JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        id: 'waba-1',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { phone_number_id: 'phone-1' },
            messages: [{ id: 'message-1', type: 'text', text: { body: 'Hello' } }],
          },
        }],
      }],
    }))

    expect(envelope?.object).toBe('whatsapp_business_account')
    expect(envelope?.entry[0]?.changes[0]?.value).toMatchObject({
      metadata: { phone_number_id: 'phone-1' },
    })
  })

  it('rejects invalid JSON and non-WhatsApp objects', () => {
    expect(parseMetaWebhookEnvelope('{')).toBeNull()
    expect(parseMetaWebhookEnvelope(JSON.stringify({ object: 'page', entry: [] }))).toBeNull()
  })
})
