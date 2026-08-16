import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  extractMetaWhatsappInboundMessages,
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

  it('extracts bounded text messages and their channel-local identity', () => {
    const envelope = parseMetaWebhookEnvelope(JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        id: 'waba-1',
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'phone-1' },
            contacts: [{ wa_id: '34123456789', profile: { name: 'Ada' } }],
            messages: [{
              id: 'message-1',
              from: '34123456789',
              timestamp: '1786723200',
              type: 'text',
              text: { body: '  What time does the show start?  ' },
              context: { id: 'previous-message' },
            }],
          },
        }],
      }],
    }))

    expect(envelope).not.toBeNull()
    expect(extractMetaWhatsappInboundMessages(envelope!)).toEqual([{
      wabaId: 'waba-1',
      phoneNumberId: 'phone-1',
      providerMessageId: 'message-1',
      senderWaId: '34123456789',
      profileName: 'Ada',
      messageType: 'text',
      bodyText: 'What time does the show start?',
      providerTimestamp: '2026-08-14T16:00:00.000Z',
      contextProviderMessageId: 'previous-message',
      processable: true,
      metadata: { hasContext: true },
    }])
  })

  it('keeps unsupported messages for handoff without retaining their provider payload', () => {
    const envelope = parseMetaWebhookEnvelope(JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        id: 'waba-1',
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'phone-1' },
            messages: [{
              id: 'message-2',
              from: '34123456789',
              type: 'image',
              image: { id: 'private-media-id', caption: 'private caption' },
            }],
          },
        }],
      }],
    }))

    expect(envelope).not.toBeNull()
    expect(extractMetaWhatsappInboundMessages(envelope!)).toEqual([expect.objectContaining({
      providerMessageId: 'message-2',
      messageType: 'image',
      bodyText: null,
      processable: false,
      metadata: { hasContext: false },
    })])
    expect(JSON.stringify(extractMetaWhatsappInboundMessages(envelope!))).not.toContain('private-media-id')
  })

  it('ignores delivery status notifications that contain no inbound messages', () => {
    const envelope = parseMetaWebhookEnvelope(JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        id: 'waba-1',
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'phone-1' },
            statuses: [{ id: 'outbound-1', status: 'delivered' }],
          },
        }],
      }],
    }))

    expect(envelope).not.toBeNull()
    expect(extractMetaWhatsappInboundMessages(envelope!)).toEqual([])
  })
})
