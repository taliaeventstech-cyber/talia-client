import type { createAdminClient } from '@/lib/supabase/admin'
import { createHash } from 'node:crypto'
import {
  metaMarketingAdCallToActionSchema,
  metaMarketingPromotablePageSchema,
  type MetaMarketingAdCallToAction,
  type MetaMarketingPromotablePage,
} from '@/types/marketing'
import { z } from 'zod'
import {
  claimMetaMarketingAdCreation,
  completeMetaMarketingAdCreation,
  failMetaMarketingAdCreation,
  getMetaMarketingSyncContext,
} from './connection-service'
import { parseMetaMarketingCredentialMetadata } from './credentials'
import { getMetaMarketingOAuthConfig } from './oauth'

type AdminClient = ReturnType<typeof createAdminClient>

const adInputSchema = z.object({
  tenantId: z.uuid(),
  actorUserId: z.uuid(),
  requestId: z.uuid(),
  providerAdSetId: z.string().trim().regex(/^\d{1,30}$/),
  pageId: z.string().trim().regex(/^\d{1,30}$/),
  name: z.string().trim().min(1).max(200),
  primaryText: z.string().trim().min(1).max(500),
  headline: z.string().trim().min(1).max(200),
  destinationUrl: z.string().trim().max(2048),
  imageBytes: z.instanceof(Uint8Array),
  imageMimeType: z.string().trim(),
  callToAction: metaMarketingAdCallToActionSchema,
})

export const META_MARKETING_AD_IMAGE_MAX_BYTES = 3 * 1024 * 1024

const imageUploadResponseSchema = z.object({
  images: z.record(z.string(), z.object({
    hash: z.string().regex(/^[0-9a-fA-F]{32}$/),
  })),
})

const providerIdResponseSchema = z.object({
  id: z.string().regex(/^\d{1,30}$/),
})

const promotablePagesResponseSchema = z.object({
  data: z.array(metaMarketingPromotablePageSchema).max(100),
})

export class MetaMarketingAdCreationError extends Error {
  constructor(
    public readonly code: string,
    public readonly kind: 'invalid' | 'connection' | 'in_progress' | 'provider' | 'save',
  ) {
    super(code)
    this.name = 'MetaMarketingAdCreationError'
  }
}

export async function listMetaMarketingPromotablePages(
  admin: AdminClient,
  input: { tenantId: string; actorUserId: string },
  options: { fetcher?: typeof fetch; timeoutMs?: number; now?: number } = {},
): Promise<MetaMarketingPromotablePage[]> {
  const context = await getMetaMarketingSyncContext(admin, input)
  if (!context) return []

  const credentials = parseMetaMarketingCredentialMetadata(context.credential_metadata)
  if (Date.parse(credentials.expiresAt) <= (options.now ?? Date.now())) {
    throw new MetaMarketingAdCreationError(
      'meta_marketing_ad_creation_token_expired',
      'connection',
    )
  }

  return fetchMetaMarketingPromotablePages(
    context.ad_account_id,
    credentials.accessToken,
    options,
  )
}

export async function createPausedMetaMarketingTrafficAd(
  admin: AdminClient,
  rawInput: z.input<typeof adInputSchema>,
  options: { fetcher?: typeof fetch; timeoutMs?: number; now?: number } = {},
) {
  const parsed = adInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    throw new MetaMarketingAdCreationError('meta_marketing_ad_creation_invalid', 'invalid')
  }

  const input = {
    ...parsed.data,
    destinationUrl: requirePublicHttpsUrl(parsed.data.destinationUrl),
    image: validateMetaMarketingAdImage(
      parsed.data.imageBytes,
      parsed.data.imageMimeType,
    ),
  }

  let claim
  try {
    claim = await claimMetaMarketingAdCreation(admin, input)
  } catch {
    throw new MetaMarketingAdCreationError(
      'meta_marketing_ad_creation_unavailable',
      'connection',
    )
  }

  if (claim.outcome === 'succeeded') {
    return {
      providerCreativeId: claim.provider_creative_id,
      providerAdId: claim.provider_ad_id,
      deduplicated: true,
    }
  }
  if (claim.outcome === 'processing') {
    throw new MetaMarketingAdCreationError(
      'meta_marketing_ad_creation_in_progress',
      'in_progress',
    )
  }
  if (claim.outcome === 'failed') {
    throw new MetaMarketingAdCreationError(
      'meta_marketing_ad_creation_retry_with_new_request',
      'provider',
    )
  }

  let providerCreated = false
  try {
    const credentials = parseMetaMarketingCredentialMetadata(claim.credential_metadata)
    if (Date.parse(credentials.expiresAt) <= (options.now ?? Date.now())) {
      throw new MetaMarketingAdCreationError(
        'meta_marketing_ad_creation_token_expired',
        'connection',
      )
    }

    const pages = await fetchMetaMarketingPromotablePages(
      claim.ad_account_id,
      credentials.accessToken,
      options,
    )
    if (!pages.some((page) => page.id === input.pageId)) {
      throw new MetaMarketingAdCreationError(
        'meta_marketing_ad_creation_page_unavailable',
        'connection',
      )
    }

    const image = await postMetaMarketingAdImage(
      claim.ad_account_id,
      credentials.accessToken,
      input.image.bytes,
      options,
    )
    providerCreated = true

    const creative = await postMetaMarketingLinkCreative(
      claim.ad_account_id,
      credentials.accessToken,
      { ...input, imageHash: image.hash },
      options,
    )

    const ad = await postPausedMetaMarketingAd(
      claim.ad_account_id,
      credentials.accessToken,
      {
        name: input.name,
        providerAdSetId: input.providerAdSetId,
        providerCreativeId: creative.id,
      },
      options,
    )

    await completeMetaMarketingAdCreation(admin, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      requestId: input.requestId,
      providerImageHash: image.hash,
      providerCreativeId: creative.id,
      providerAdId: ad.id,
    })

    return {
      providerCreativeId: creative.id,
      providerAdId: ad.id,
      providerImageHash: image.hash,
      deduplicated: false,
    }
  } catch (error) {
    const normalized = normalizeAdCreationError(error, providerCreated)
    if (!providerCreated && normalized.kind !== 'save') {
      try {
        await failMetaMarketingAdCreation(admin, {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          requestId: input.requestId,
          errorCode: normalized.code,
        })
      } catch {
        // Preserve the original bounded error and leave the request claimed.
      }
    }
    throw normalized
  }
}

export async function postMetaMarketingAdImage(
  adAccountId: string,
  accessToken: string,
  imageBytes: Uint8Array,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const accountId = requireAdAccountId(adAccountId)
  const config = getMetaMarketingOAuthConfig()
  const url = new URL(
    `https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(accountId)}/adimages`,
  )
  const body = new URLSearchParams({
    bytes: Buffer.from(imageBytes).toString('base64'),
  })
  const payload = await providerJsonRequest(url, accessToken, body, {
    ...options,
    timeoutMs: options.timeoutMs ?? 30_000,
  })
  const parsed = imageUploadResponseSchema.safeParse(payload)
  const firstImage = parsed.success ? Object.values(parsed.data.images)[0] : undefined
  if (!firstImage) {
    throw new MetaMarketingAdCreationError(
      'meta_marketing_ad_image_response_invalid',
      'save',
    )
  }
  return { hash: firstImage.hash.toLowerCase() }
}

export async function fetchMetaMarketingPromotablePages(
  adAccountId: string,
  accessToken: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const accountId = requireAdAccountId(adAccountId)
  const config = getMetaMarketingOAuthConfig()
  const url = new URL(
    `https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(accountId)}/promote_pages`,
  )
  url.searchParams.set('fields', 'id,name')
  url.searchParams.set('limit', '100')

  const payload = await providerJsonRequest(url, accessToken, undefined, options)
  const parsed = promotablePagesResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new MetaMarketingAdCreationError(
      'meta_marketing_ad_pages_response_invalid',
      'provider',
    )
  }
  return parsed.data.data
}

export async function postMetaMarketingLinkCreative(
  adAccountId: string,
  accessToken: string,
  input: {
    pageId: string
    name: string
    primaryText: string
    headline: string
    destinationUrl: string
    imageHash: string
    callToAction: MetaMarketingAdCallToAction
  },
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const accountId = requireAdAccountId(adAccountId)
  const config = getMetaMarketingOAuthConfig()
  const url = new URL(
    `https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(accountId)}/adcreatives`,
  )
  const body = new URLSearchParams({
    name: `${input.name.trim()} · Creative`,
    object_story_spec: JSON.stringify({
      page_id: requireProviderId(input.pageId),
      link_data: {
        message: input.primaryText.trim(),
        link: requirePublicHttpsUrl(input.destinationUrl),
        name: input.headline.trim(),
        image_hash: requireImageHash(input.imageHash),
        call_to_action: {
          type: metaMarketingAdCallToActionSchema.parse(input.callToAction),
          value: { link: requirePublicHttpsUrl(input.destinationUrl) },
        },
      },
    }),
  })
  const payload = await providerJsonRequest(url, accessToken, body, options)
  return parseProviderId(payload, 'meta_marketing_ad_creative_response_invalid')
}

export async function postPausedMetaMarketingAd(
  adAccountId: string,
  accessToken: string,
  input: { name: string; providerAdSetId: string; providerCreativeId: string },
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const accountId = requireAdAccountId(adAccountId)
  const config = getMetaMarketingOAuthConfig()
  const url = new URL(
    `https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(accountId)}/ads`,
  )
  const body = new URLSearchParams({
    name: input.name.trim(),
    adset_id: requireProviderId(input.providerAdSetId),
    creative: JSON.stringify({ creative_id: requireProviderId(input.providerCreativeId) }),
    status: 'PAUSED',
  })
  const payload = await providerJsonRequest(url, accessToken, body, options)
  return parseProviderId(payload, 'meta_marketing_ad_response_invalid')
}

async function providerJsonRequest(
  url: URL,
  accessToken: string,
  body: URLSearchParams | undefined,
  options: { fetcher?: typeof fetch; timeoutMs?: number },
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000)
  let response: Response
  try {
    response = await (options.fetcher ?? fetch)(url, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      ...(body ? { body } : {}),
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch {
    throw new MetaMarketingAdCreationError(
      'meta_marketing_ad_provider_unavailable',
      'provider',
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const unauthorized = response.status === 401 || response.status === 403
    throw new MetaMarketingAdCreationError(
      unauthorized
        ? 'meta_marketing_ad_provider_unauthorized'
        : 'meta_marketing_ad_provider_rejected',
      unauthorized ? 'connection' : 'provider',
    )
  }

  try {
    return await response.json() as unknown
  } catch {
    throw new MetaMarketingAdCreationError(
      'meta_marketing_ad_provider_response_invalid',
      'provider',
    )
  }
}

function parseProviderId(payload: unknown, code: string) {
  const parsed = providerIdResponseSchema.safeParse(payload)
  if (!parsed.success) throw new MetaMarketingAdCreationError(code, 'provider')
  return parsed.data
}

function requirePublicHttpsUrl(value: string) {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new MetaMarketingAdCreationError('meta_marketing_ad_url_invalid', 'invalid')
  }
  if (
    url.protocol !== 'https:'
    || !url.hostname
    || url.username
    || url.password
    || url.href.length > 2048
  ) {
    throw new MetaMarketingAdCreationError('meta_marketing_ad_url_invalid', 'invalid')
  }
  return url.href
}

function requireAdAccountId(value: string) {
  const normalized = value.trim()
  if (!/^(?:act_)?\d{1,30}$/.test(normalized)) {
    throw new MetaMarketingAdCreationError(
      'meta_marketing_ad_account_invalid',
      'connection',
    )
  }
  return normalized.startsWith('act_') ? normalized : `act_${normalized}`
}

function requireProviderId(value: string) {
  const normalized = value.trim()
  if (!/^\d{1,30}$/.test(normalized)) {
    throw new MetaMarketingAdCreationError('meta_marketing_ad_context_invalid', 'invalid')
  }
  return normalized
}

function requireImageHash(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(normalized)) {
    throw new MetaMarketingAdCreationError('meta_marketing_ad_image_hash_invalid', 'invalid')
  }
  return normalized
}

export function validateMetaMarketingAdImage(
  imageBytes: Uint8Array,
  declaredMimeType: string,
) {
  if (
    imageBytes.byteLength === 0
    || imageBytes.byteLength > META_MARKETING_AD_IMAGE_MAX_BYTES
  ) {
    throw new MetaMarketingAdCreationError('meta_marketing_ad_image_invalid', 'invalid')
  }

  const detectedMimeType = detectImageMimeType(imageBytes)
  const normalizedMimeType = declaredMimeType.trim().toLowerCase()
  if (!detectedMimeType || detectedMimeType !== normalizedMimeType) {
    throw new MetaMarketingAdCreationError('meta_marketing_ad_image_invalid', 'invalid')
  }

  return {
    bytes: imageBytes,
    mimeType: detectedMimeType,
    sizeBytes: imageBytes.byteLength,
    sha256: createHash('sha256').update(imageBytes).digest('hex'),
  }
}

function detectImageMimeType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | null {
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) return 'image/png'

  if (
    bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
  ) return 'image/jpeg'

  return null
}

function normalizeAdCreationError(error: unknown, providerCreated: boolean) {
  if (providerCreated) {
    return new MetaMarketingAdCreationError(
      'meta_marketing_ad_creation_completion_failed',
      'save',
    )
  }
  if (error instanceof MetaMarketingAdCreationError) return error
  if (error instanceof z.ZodError) {
    return new MetaMarketingAdCreationError(
      'meta_marketing_ad_creation_context_invalid',
      'connection',
    )
  }
  return new MetaMarketingAdCreationError(
    'meta_marketing_ad_creation_failed',
    'provider',
  )
}
