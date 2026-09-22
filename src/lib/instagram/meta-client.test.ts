import { describe, expect, it, vi } from 'vitest'
import { sendMetaInstagramText } from './meta-client'

describe('sendMetaInstagramText', () => {
  it('sends a text DM through the dedicated Instagram Graph endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({
      recipient_id: 'igsid-visitor',
      message_id: 'ig-message-outbound',
    }))

    const result = await sendMetaInstagramText({
      instagramUserId: 'ig-professional-account',
      recipientInstagramScopedId: 'igsid-visitor',
      body: 'Respuesta segura',
    }, { fetcher, accessToken: 'instagram-token', graphApiVersion: 'v26.0' })

    expect(result).toEqual({ ok: true, providerMessageId: 'ig-message-outbound' })
    expect(fetcher).toHaveBeenCalledWith(
      'https://graph.instagram.com/v26.0/ig-professional-account/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer instagram-token' }),
      }),
    )
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      recipient: { id: 'igsid-visitor' },
      message: { text: 'Respuesta segura' },
    })
  })

  it('classifies provider and network failures without exposing response bodies', async () => {
    const rejected = await sendMetaInstagramText({
      instagramUserId: 'ig-account', recipientInstagramScopedId: 'visitor', body: 'x',
    }, {
      accessToken: 'instagram-token',
      fetcher: async () => new Response('sensitive provider body', { status: 400 }),
    })
    const uncertain = await sendMetaInstagramText({
      instagramUserId: 'ig-account', recipientInstagramScopedId: 'visitor', body: 'x',
    }, {
      accessToken: 'instagram-token',
      fetcher: async () => { throw new Error('socket closed') },
    })

    expect(rejected).toEqual({
      ok: false, outcome: 'definitive_rejection', status: 400, errorCode: 'meta_instagram_http_400',
    })
    expect(uncertain).toMatchObject({ ok: false, outcome: 'uncertain', status: null })
  })
})
