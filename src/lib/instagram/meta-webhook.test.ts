import { describe, expect, it } from 'vitest'
import {
  extractMetaInstagramInboundMessages,
  parseMetaInstagramWebhookEnvelope,
} from './meta-webhook'

describe('Meta Instagram webhook', () => {
  it('parses the Instagram messaging envelope and extracts one inbound text DM', () => {
    const envelope = parseMetaInstagramWebhookEnvelope(JSON.stringify({
      object: 'instagram',
      entry: [{
        id: 'professional-account-1',
        time: 1790053200000,
        messaging: [{
          sender: { id: 'instagram-scoped-user-1' },
          recipient: { id: 'professional-account-1' },
          timestamp: 1790053200123,
          message: {
            mid: 'instagram-message-1',
            text: '  ¿A qué hora empieza la función?  ',
            reply_to: { mid: 'instagram-message-0' },
          },
        }],
      }],
    }))

    expect(envelope).not.toBeNull()
    expect(extractMetaInstagramInboundMessages(envelope!)).toEqual([{
      instagramUserId: 'professional-account-1',
      senderInstagramScopedId: 'instagram-scoped-user-1',
      providerMessageId: 'instagram-message-1',
      messageType: 'text',
      bodyText: '¿A qué hora empieza la función?',
      providerTimestamp: '2026-09-22T05:00:00.123Z',
      contextProviderMessageId: 'instagram-message-0',
      processable: true,
      metadata: {
        hasAttachments: false,
        hasReplyContext: true,
        isUnsupported: false,
      },
    }])
  })

  it('ignores echoes, self messages, deleted messages and outbound events', () => {
    const envelope = parseEnvelope([
      event({ mid: 'echo', text: 'echo', is_echo: true }),
      event({ mid: 'self', text: 'self', is_self: true }),
      event({ mid: 'deleted', is_deleted: true }),
      {
        sender: { id: 'professional-account-1' },
        recipient: { id: 'instagram-scoped-user-1' },
        message: { mid: 'outbound', text: 'outbound' },
      },
    ])

    expect(extractMetaInstagramInboundMessages(envelope)).toEqual([])
  })

  it('creates a minimal unsupported handoff without retaining media URLs or payloads', () => {
    const envelope = parseEnvelope([event({
      mid: 'image-message',
      text: 'private caption',
      attachments: [{ type: 'image', payload: { url: 'https://private.example/media' } }],
      referral: { ad_id: 'private-ad-id' },
    })])

    const messages = extractMetaInstagramInboundMessages(envelope)
    expect(messages).toEqual([expect.objectContaining({
      providerMessageId: 'image-message',
      messageType: 'image',
      bodyText: null,
      processable: false,
      metadata: {
        hasAttachments: true,
        hasReplyContext: false,
        isUnsupported: false,
      },
    })])
    expect(JSON.stringify(messages)).not.toContain('private.example')
    expect(JSON.stringify(messages)).not.toContain('private caption')
    expect(JSON.stringify(messages)).not.toContain('private-ad-id')
  })

  it('rejects invalid JSON and non-Instagram objects', () => {
    expect(parseMetaInstagramWebhookEnvelope('{')).toBeNull()
    expect(parseMetaInstagramWebhookEnvelope(JSON.stringify({ object: 'page', entry: [] })))
      .toBeNull()
  })

  it('normalizes the documented batched envelope form', () => {
    const single = JSON.parse(JSON.stringify({
      object: 'instagram',
      entry: [{ id: 'professional-account-1', messaging: [] }],
    }))
    const envelope = parseMetaInstagramWebhookEnvelope(JSON.stringify([single, single]))

    expect(envelope?.entry).toHaveLength(2)
  })
})

function event(message: Record<string, unknown>) {
  return {
    sender: { id: 'instagram-scoped-user-1' },
    recipient: { id: 'professional-account-1' },
    timestamp: 1790053200123,
    message,
  }
}

function parseEnvelope(messaging: Array<Record<string, unknown>>) {
  const envelope = parseMetaInstagramWebhookEnvelope(JSON.stringify({
    object: 'instagram',
    entry: [{ id: 'professional-account-1', messaging }],
  }))
  if (!envelope) throw new Error('Invalid Instagram test envelope')
  return envelope
}
