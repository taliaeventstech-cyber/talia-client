import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPausedMetaMarketingTrafficAd,
  postMetaMarketingAdImage,
  postMetaMarketingLinkCreative,
  postPausedMetaMarketingAd,
} from './ad-creation-service'
import { buildMetaMarketingCredentialMetadata } from './credentials'

const tenantId = '657c9c3e-bf4a-45ce-868d-45a2f48db2fb'
const actorUserId = '0d423c31-f1cb-49a4-9b23-6876c1f06e19'
const requestId = '8ced31cc-e703-42f2-aa38-e657f1c484f4'
const connectionId = 'cf3e88d4-af56-4b67-a31e-ce4378b2a444'
const imageHash = '0123456789abcdef0123456789abcdef'

describe('Meta Marketing paused traffic ad creation', () => {
  beforeEach(() => {
    vi.stubEnv('META_MARKETING_APP_ID', 'meta-app-id')
    vi.stubEnv('META_MARKETING_APP_SECRET', 'meta-app-secret')
    vi.stubEnv('META_MARKETING_GRAPH_API_VERSION', 'v26.0')
    vi.stubEnv('META_MARKETING_TOKEN_ENCRYPTION_KEY', 'encryption-key-that-is-at-least-32-characters')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('builds a Page-backed link creative from bounded content', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: '222333444' }))

    await expect(postMetaMarketingLinkCreative(
      'act_123456',
      'sensitive-token',
      { ...validInput(), imageHash },
      { fetcher: fetcher as typeof fetch },
    )).resolves.toEqual({ id: '222333444' })

    const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit]
    const body = init.body as URLSearchParams
    const story = JSON.parse(body.get('object_story_spec') ?? '{}')
    expect(url.toString()).toBe('https://graph.facebook.com/v26.0/act_123456/adcreatives')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sensitive-token' })
    expect(story).toEqual({
      page_id: '444555666',
      link_data: {
        message: 'Book before Sunday.',
        link: 'https://example.org/tickets',
        name: 'Tickets now available',
        image_hash: imageHash,
        call_to_action: {
          type: 'BUY_TICKETS',
          value: { link: 'https://example.org/tickets' },
        },
      },
    })
  })

  it('uploads image bytes to the connected ad account and returns Meta image_hash', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      images: { bytes: { hash: imageHash } },
    }))

    await expect(postMetaMarketingAdImage(
      'act_123456',
      'sensitive-token',
      pngBytes(),
      { fetcher: fetcher as typeof fetch },
    )).resolves.toEqual({ hash: imageHash })

    const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit]
    const body = init.body as URLSearchParams
    expect(url.toString()).toBe('https://graph.facebook.com/v26.0/act_123456/adimages')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sensitive-token' })
    expect(Buffer.from(body.get('bytes') ?? '', 'base64')).toEqual(Buffer.from(pngBytes()))
  })

  it('forces PAUSED when creating the final ad', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: '777888999' }))

    await expect(postPausedMetaMarketingAd(
      '123456',
      'sensitive-token',
      {
        name: 'Early bird image',
        providerAdSetId: '987654321',
        providerCreativeId: '222333444',
      },
      { fetcher: fetcher as typeof fetch },
    )).resolves.toEqual({ id: '777888999' })

    const [url, init] = fetcher.mock.calls[0] as [URL, RequestInit]
    const body = init.body as URLSearchParams
    expect(url.toString()).toBe('https://graph.facebook.com/v26.0/act_123456/ads')
    expect(body.get('adset_id')).toBe('987654321')
    expect(JSON.parse(body.get('creative') ?? '{}')).toEqual({ creative_id: '222333444' })
    expect(body.get('status')).toBe('PAUSED')
  })

  it('revalidates the Page, creates both objects and completes the request', async () => {
    const rpc = createRpc()
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: '444555666', name: 'TALIA' }] }))
      .mockResolvedValueOnce(jsonResponse({ images: { bytes: { hash: imageHash } } }))
      .mockResolvedValueOnce(jsonResponse({ id: '222333444' }))
      .mockResolvedValueOnce(jsonResponse({ id: '777888999' }))

    await expect(createPausedMetaMarketingTrafficAd(
      { rpc } as never,
      validInput(),
      { fetcher: fetcher as typeof fetch, now: Date.parse('2026-10-11T10:00:00.000Z') },
    )).resolves.toEqual({
      providerCreativeId: '222333444',
      providerAdId: '777888999',
      providerImageHash: imageHash,
      deduplicated: false,
    })

    expect(rpc).toHaveBeenCalledWith('complete_meta_marketing_ad_upload_creation', {
      p_theatre_id: tenantId,
      p_actor_user_id: actorUserId,
      p_request_id: requestId,
      p_provider_image_hash: imageHash,
      p_provider_creative_id: '222333444',
      p_provider_ad_id: '777888999',
    })
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('sensitive-token')
  })

  it('does not call Meta when the idempotency request already succeeded', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        outcome: 'succeeded',
        request_id: requestId,
        provider_creative_id: '222333444',
        provider_ad_id: '777888999',
      },
      error: null,
    })
    const fetcher = vi.fn()

    await expect(createPausedMetaMarketingTrafficAd(
      { rpc } as never,
      validInput(),
      { fetcher: fetcher as typeof fetch },
    )).resolves.toMatchObject({ deduplicated: true })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects a client Page that is not promotable for the ad account', async () => {
    const rpc = createRpc()
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      data: [{ id: '111111111', name: 'Another Page' }],
    }))

    await expect(createPausedMetaMarketingTrafficAd(
      { rpc } as never,
      validInput(),
      { fetcher: fetcher as typeof fetch, now: Date.parse('2026-10-11T10:00:00.000Z') },
    )).rejects.toMatchObject({
      code: 'meta_marketing_ad_creation_page_unavailable',
      kind: 'connection',
    })
    expect(rpc).toHaveBeenCalledWith('fail_meta_marketing_ad_creation', {
      p_theatre_id: tenantId,
      p_actor_user_id: actorUserId,
      p_request_id: requestId,
      p_error_code: 'meta_marketing_ad_creation_page_unavailable',
    })
  })

  it('leaves the request claimed when the creative exists but ad creation fails', async () => {
    const rpc = createRpc()
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: '444555666', name: 'TALIA' }] }))
      .mockResolvedValueOnce(jsonResponse({ images: { bytes: { hash: imageHash } } }))
      .mockResolvedValueOnce(jsonResponse({ id: '222333444' }))
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'private detail' } }, 400))

    await expect(createPausedMetaMarketingTrafficAd(
      { rpc } as never,
      validInput(),
      { fetcher: fetcher as typeof fetch, now: Date.parse('2026-10-11T10:00:00.000Z') },
    )).rejects.toMatchObject({
      code: 'meta_marketing_ad_creation_completion_failed',
      kind: 'save',
    })
    expect(rpc).not.toHaveBeenCalledWith(
      'fail_meta_marketing_ad_creation',
      expect.anything(),
    )
  })

  it('rejects a spoofed image type before claiming or calling Meta', async () => {
    const rpc = createRpc()
    const fetcher = vi.fn()

    await expect(createPausedMetaMarketingTrafficAd(
      { rpc } as never,
      { ...validInput(), imageBytes: new Uint8Array([1, 2, 3]) },
      { fetcher: fetcher as typeof fetch },
    )).rejects.toMatchObject({
      code: 'meta_marketing_ad_image_invalid',
      kind: 'invalid',
    })
    expect(rpc).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('keeps the request claimed when Meta accepts an image but returns an invalid body', async () => {
    const rpc = createRpc()
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: '444555666', name: 'TALIA' }] }))
      .mockResolvedValueOnce(jsonResponse({ images: {} }))

    await expect(createPausedMetaMarketingTrafficAd(
      { rpc } as never,
      validInput(),
      { fetcher: fetcher as typeof fetch, now: Date.parse('2026-10-11T10:00:00.000Z') },
    )).rejects.toMatchObject({
      code: 'meta_marketing_ad_image_response_invalid',
      kind: 'save',
    })
    expect(rpc).not.toHaveBeenCalledWith(
      'fail_meta_marketing_ad_creation',
      expect.anything(),
    )
  })
})

function createRpc() {
  const credentialMetadata = buildMetaMarketingCredentialMetadata({
    accessToken: 'sensitive-token',
    expiresAt: '2030-12-04T10:00:00.000Z',
  })
  return vi.fn(async (name: string) => {
    if (name === 'claim_meta_marketing_ad_upload_creation') {
      return {
        data: {
          outcome: 'claimed',
          request_id: requestId,
          connection_id: connectionId,
          ad_account_id: 'act_123456',
          credential_metadata: credentialMetadata,
        },
        error: null,
      }
    }
    if (name === 'complete_meta_marketing_ad_upload_creation') return { data: true, error: null }
    if (name === 'fail_meta_marketing_ad_creation') return { data: true, error: null }
    return { data: null, error: new Error('unexpected_rpc') }
  })
}

function validInput() {
  return {
    tenantId,
    actorUserId,
    requestId,
    providerAdSetId: '987654321',
    pageId: '444555666',
    name: 'Early bird image',
    primaryText: 'Book before Sunday.',
    headline: 'Tickets now available',
    destinationUrl: 'https://example.org/tickets',
    imageBytes: pngBytes(),
    imageMimeType: 'image/png',
    callToAction: 'BUY_TICKETS' as const,
  }
}

function pngBytes() {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
