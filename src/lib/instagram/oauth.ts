import crypto from 'node:crypto'
import { z } from 'zod'

export const INSTAGRAM_OAUTH_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
] as const

const INSTAGRAM_AUTHORIZATION_ENDPOINT = 'https://www.instagram.com/oauth/authorize'
const INSTAGRAM_TOKEN_ENDPOINT = 'https://api.instagram.com/oauth/access_token'
const INSTAGRAM_LONG_LIVED_TOKEN_ENDPOINT = 'https://graph.instagram.com/access_token'
const STATE_TTL_MS = 10 * 60 * 1000

const shortLivedTokenSchema = z.object({
  access_token: z.string().min(1),
})

const longLivedTokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().int().positive(),
})

const professionalProfileSchema = z.object({
  id: z.string().min(1).max(200),
  user_id: z.string().min(1).max(200),
  username: z.string().min(1).max(200),
  account_type: z.string().min(1),
})

const webhookSubscriptionSchema = z.object({ success: z.literal(true) })

type InstagramOAuthState = {
  provider: 'instagram'
  tenantId: string
  userId: string
  nonce: string
  exp: number
}

export type InstagramShortLivedToken = z.infer<typeof shortLivedTokenSchema>
export type InstagramLongLivedToken = z.infer<typeof longLivedTokenSchema>
export type InstagramProfessionalProfile = {
  id: string
  username: string
  accountType: 'business' | 'creator'
}

export class InstagramOAuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number | null = null,
  ) {
    super(code)
    this.name = 'InstagramOAuthError'
  }
}

export function getInstagramOAuthConfig() {
  const appId = process.env.META_INSTAGRAM_APP_ID
  const appSecret = process.env.META_INSTAGRAM_APP_SECRET
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  if (!appId || !appSecret) {
    throw new InstagramOAuthError('instagram_oauth_configuration_missing')
  }

  return {
    appId,
    appSecret,
    redirectUri: `${appUrl}/api/instagram/callback`,
  }
}

export function createInstagramOAuthState(input: { tenantId: string; userId: string }) {
  const payload: InstagramOAuthState = {
    provider: 'instagram',
    tenantId: requireIdentifier(input.tenantId),
    userId: requireIdentifier(input.userId),
    nonce: crypto.randomBytes(16).toString('base64url'),
    exp: Date.now() + STATE_TTL_MS,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encodedPayload}.${signState(encodedPayload)}`
}

export function verifyInstagramOAuthState(state: string): InstagramOAuthState {
  const [encodedPayload, signature, ...rest] = state.split('.')
  if (!encodedPayload || !signature || rest.length > 0) {
    throw new InstagramOAuthError('instagram_oauth_state_invalid')
  }

  const expectedSignature = signState(encodedPayload)
  if (!safeEqual(signature, expectedSignature)) {
    throw new InstagramOAuthError('instagram_oauth_state_invalid')
  }

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch {
    throw new InstagramOAuthError('instagram_oauth_state_invalid')
  }

  if (!isInstagramOAuthState(payload) || Date.now() > payload.exp) {
    throw new InstagramOAuthError('instagram_oauth_state_expired')
  }

  return payload
}

export function getInstagramAuthorizationUrl(input: { tenantId: string; userId: string }) {
  const config = getInstagramOAuthConfig()
  const url = new URL(INSTAGRAM_AUTHORIZATION_ENDPOINT)

  url.searchParams.set('client_id', config.appId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', INSTAGRAM_OAUTH_SCOPES.join(','))
  url.searchParams.set('state', createInstagramOAuthState(input))

  return url
}

export async function exchangeInstagramAuthorizationCode(
  code: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<InstagramShortLivedToken> {
  const config = getInstagramOAuthConfig()
  const body = new FormData()
  body.set('client_id', config.appId)
  body.set('client_secret', config.appSecret)
  body.set('grant_type', 'authorization_code')
  body.set('redirect_uri', config.redirectUri)
  body.set('code', requireIdentifier(code))

  const response = await request(INSTAGRAM_TOKEN_ENDPOINT, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  }, options.fetcher)

  return parseResponse(response, shortLivedTokenSchema, 'instagram_code_exchange')
}

export async function exchangeInstagramLongLivedToken(
  shortLivedAccessToken: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<InstagramLongLivedToken> {
  const config = getInstagramOAuthConfig()
  const url = new URL(INSTAGRAM_LONG_LIVED_TOKEN_ENDPOINT)
  url.searchParams.set('grant_type', 'ig_exchange_token')
  url.searchParams.set('client_secret', config.appSecret)
  url.searchParams.set('access_token', requireIdentifier(shortLivedAccessToken))

  const response = await request(url, {
    method: 'GET',
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  }, options.fetcher)

  return parseResponse(response, longLivedTokenSchema, 'instagram_long_lived_token_exchange')
}

export async function fetchInstagramProfessionalProfile(
  accessToken: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<InstagramProfessionalProfile> {
  const url = new URL('https://graph.instagram.com/me')
  url.searchParams.set('fields', 'id,user_id,username,account_type')

  const response = await request(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${requireIdentifier(accessToken)}` },
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  }, options.fetcher)
  const profile = await parseResponse(
    response,
    professionalProfileSchema,
    'instagram_profile_request',
  )
  const accountType = normalizeProfessionalAccountType(profile.account_type)
  if (!accountType) {
    throw new InstagramOAuthError('instagram_professional_account_required', 403)
  }

  // Instagram Login returns both an app-scoped `id` and the Professional
  // account `user_id`. Webhook recipient/entry IDs and the Send API use the
  // latter, so persisting `id` makes otherwise valid webhook events unmatched.
  return { id: profile.user_id, username: profile.username, accountType }
}

export async function subscribeInstagramMessagingWebhooks(
  accessToken: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const version = normalizeGraphApiVersion(process.env.META_INSTAGRAM_GRAPH_API_VERSION)
  const url = new URL(`https://graph.instagram.com/${version}/me/subscribed_apps`)
  const body = new URLSearchParams({
    subscribed_fields: 'messages',
    access_token: requireIdentifier(accessToken),
  })
  const response = await request(url, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  }, options.fetcher)

  await parseResponse(
    response,
    webhookSubscriptionSchema,
    'instagram_webhook_subscription',
  )
}

export async function unsubscribeInstagramMessagingWebhooks(
  accessToken: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const version = normalizeGraphApiVersion(process.env.META_INSTAGRAM_GRAPH_API_VERSION)
  const url = new URL(`https://graph.instagram.com/${version}/me/subscribed_apps`)
  const body = new URLSearchParams({
    access_token: requireIdentifier(accessToken),
  })
  const response = await request(url, {
    method: 'DELETE',
    body,
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  }, options.fetcher)

  await parseResponse(
    response,
    webhookSubscriptionSchema,
    'instagram_webhook_unsubscription',
  )
}

async function request(
  url: string | URL,
  init: RequestInit,
  fetcher: typeof fetch = fetch,
) {
  try {
    return await fetcher(url, init)
  } catch {
    throw new InstagramOAuthError('instagram_oauth_network_error')
  }
}

async function parseResponse<T>(response: Response, schema: z.ZodType<T>, operation: string): Promise<T> {
  if (!response.ok) {
    throw new InstagramOAuthError(`${operation}_http_${response.status}`, response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new InstagramOAuthError(`${operation}_invalid_response`, response.status)
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new InstagramOAuthError(`${operation}_invalid_response`, response.status)
  }

  return parsed.data
}

function signState(encodedPayload: string) {
  const secret = process.env.INSTAGRAM_OAUTH_STATE_SECRET
  if (!secret || secret.length < 32) {
    throw new InstagramOAuthError('instagram_oauth_state_secret_missing')
  }

  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function requireIdentifier(value: string) {
  const normalized = value.trim()
  if (!normalized || normalized.length > 500) {
    throw new InstagramOAuthError('instagram_oauth_input_invalid')
  }
  return normalized
}

function isInstagramOAuthState(value: unknown): value is InstagramOAuthState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return record.provider === 'instagram'
    && typeof record.tenantId === 'string'
    && record.tenantId.length > 0
    && typeof record.userId === 'string'
    && record.userId.length > 0
    && typeof record.nonce === 'string'
    && record.nonce.length > 0
    && typeof record.exp === 'number'
    && Number.isFinite(record.exp)
}

function normalizeProfessionalAccountType(value: string): 'business' | 'creator' | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'business') return 'business'
  if (normalized === 'creator' || normalized === 'media_creator') return 'creator'
  return null
}

function normalizeGraphApiVersion(value: string | undefined) {
  return /^v\d+\.\d+$/.test(value ?? '') ? value! : 'v26.0'
}
