import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendMetaWhatsappText } from './meta-client'

afterEach(() => vi.unstubAllEnvs())

describe('sendMetaWhatsappText', () => {
  it('sends a contextual text reply through the configured Graph version', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ messages: [{ id: 'wamid.outbound' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    const result = await sendMetaWhatsappText({
      phoneNumberId: 'phone-1',
      recipientWaId: '34123456789',
      body: 'Respuesta segura',
      replyToProviderMessageId: 'wamid.inbound',
    }, { fetcher, accessToken: 'secret-token', graphApiVersion: 'v26.0' })

    expect(result).toEqual({ ok: true, providerMessageId: 'wamid.outbound' })
    expect(fetcher).toHaveBeenCalledWith(
      'https://graph.facebook.com/v26.0/phone-1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
      }),
    )
    const request = fetcher.mock.calls[0][1]
    expect(JSON.parse(String(request?.body))).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '34123456789',
      context: { message_id: 'wamid.inbound' },
      type: 'text',
      text: { preview_url: false, body: 'Respuesta segura' },
    })
  })

  it('distinguishes safe retry responses from uncertain network outcomes', async () => {
    const rejected = await sendMetaWhatsappText({
      phoneNumberId: 'phone-1', recipientWaId: '34', body: 'x', replyToProviderMessageId: 'inbound',
    }, {
      accessToken: 'secret-token',
      fetcher: async () => new Response('{}', { status: 503 }),
    })
    const uncertain = await sendMetaWhatsappText({
      phoneNumberId: 'phone-1', recipientWaId: '34', body: 'x', replyToProviderMessageId: 'inbound',
    }, {
      accessToken: 'secret-token',
      fetcher: async () => { throw new Error('socket closed') },
    })

    expect(rejected).toMatchObject({ ok: false, outcome: 'transient_rejection', status: 503 })
    expect(uncertain).toMatchObject({ ok: false, outcome: 'uncertain', status: null })
  })

  it('fails closed when the server token is missing', async () => {
    vi.stubEnv('META_WHATSAPP_ACCESS_TOKEN', '')
    const result = await sendMetaWhatsappText({
      phoneNumberId: 'phone-1', recipientWaId: '34', body: 'x', replyToProviderMessageId: 'inbound',
    })
    expect(result).toMatchObject({ ok: false, outcome: 'definitive_rejection', errorCode: 'meta_access_token_missing' })
  })
})
