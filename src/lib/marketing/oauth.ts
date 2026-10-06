import crypto from 'node:crypto'
import { z } from 'zod'

export const META_MARKETING_OAUTH_SCOPES = [
  'ads_read',
  'ads_management',
  'business_management',
] as const

const STATE_TTL_MS = 30 * 60 * 1000
const MAX_GRAPH_PAGES = 5
const MAX_BUSINESSES = 25

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().int().positive().optional(),
})

const metaUserSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200).optional(),
})

const businessSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
})

const adAccountSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  currency: z.string().length(3).optional(),
  account_status: z.number().int().optional(),
  timezone_name: z.string().min(1).max(200).optional(),
})

const permissionSchema = z.object({
  permission: z.string().min(1),
  status: z.string().min(1),
})

type MetaMarketingOAuthState = {
  provider: 'meta_marketing'
  tenantId: string
  userId: string
  nonce: string
  exp: number
}

export type MetaMarketingToken = z.infer<typeof tokenResponseSchema>
export type MetaMarketingUser = z.infer<typeof metaUserSchema>
export type MetaMarketingAdAccount = z.infer<typeof adAccountSchema>
export type MetaMarketingBusiness = z.infer<typeof businessSchema> & {
  adAccounts: MetaMarketingAdAccount[]
}

export class MetaMarketingOAuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number | null = null,
  ) {
    super(code)
    this.name = 'MetaMarketingOAuthError'
  }
}

export function getMetaMarketingOAuthConfig() {
  const appId = process.env.META_MARKETING_APP_ID
  const appSecret = process.env.META_MARKETING_APP_SECRET
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  if (!appId || !appSecret) {
    throw new MetaMarketingOAuthError('meta_marketing_oauth_configuration_missing')
  }

  return {
    appId,
    appSecret,
    redirectUri: `${appUrl}/api/marketing/meta/callback`,
    graphVersion: normalizeGraphApiVersion(process.env.META_MARKETING_GRAPH_API_VERSION),
  }
}

export function createMetaMarketingOAuthState(input: { tenantId: string; userId: string }) {
  const payload: MetaMarketingOAuthState = {
    provider: 'meta_marketing',
    tenantId: requireIdentifier(input.tenantId),
    userId: requireIdentifier(input.userId),
    nonce: crypto.randomBytes(16).toString('base64url'),
    exp: Date.now() + STATE_TTL_MS,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encodedPayload}.${signState(encodedPayload)}`
}

export function verifyMetaMarketingOAuthState(state: string): MetaMarketingOAuthState {
  const [encodedPayload, signature, ...rest] = state.split('.')
  if (!encodedPayload || !signature || rest.length > 0) {
    throw new MetaMarketingOAuthError('meta_marketing_oauth_state_invalid')
  }

  const expectedSignature = signState(encodedPayload)
  if (!safeEqual(signature, expectedSignature)) {
    throw new MetaMarketingOAuthError('meta_marketing_oauth_state_invalid')
  }

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch {
    throw new MetaMarketingOAuthError('meta_marketing_oauth_state_invalid')
  }

  if (!isMetaMarketingOAuthState(payload) || Date.now() > payload.exp) {
    throw new MetaMarketingOAuthError('meta_marketing_oauth_state_expired')
  }

  return payload
}

export function getMetaMarketingAuthorizationUrl(input: { tenantId: string; userId: string }) {
  const config = getMetaMarketingOAuthConfig()
  const url = new URL(`https://www.facebook.com/${config.graphVersion}/dialog/oauth`)
  url.searchParams.set('client_id', config.appId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', META_MARKETING_OAUTH_SCOPES.join(','))
  url.searchParams.set('state', createMetaMarketingOAuthState(input))
  return url
}

export async function exchangeMetaMarketingAuthorizationCode(
  code: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const config = getMetaMarketingOAuthConfig()
  const url = graphUrl('/oauth/access_token')
  url.searchParams.set('client_id', config.appId)
  url.searchParams.set('client_secret', config.appSecret)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('code', requireIdentifier(code))

  return requestJson(
    url,
    tokenResponseSchema,
    'meta_marketing_code_exchange',
    options,
  )
}

export async function exchangeMetaMarketingLongLivedToken(
  shortLivedAccessToken: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const config = getMetaMarketingOAuthConfig()
  const url = graphUrl('/oauth/access_token')
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', config.appId)
  url.searchParams.set('client_secret', config.appSecret)
  url.searchParams.set('fb_exchange_token', requireIdentifier(shortLivedAccessToken))

  return requestJson(
    url,
    tokenResponseSchema,
    'meta_marketing_long_lived_token_exchange',
    options,
  )
}

export async function fetchMetaMarketingUser(
  accessToken: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const url = graphUrl('/me')
  url.searchParams.set('fields', 'id,name')
  return requestJson(url, metaUserSchema, 'meta_marketing_user_request', options, accessToken)
}

export async function fetchMetaMarketingGrantedScopes(
  accessToken: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const url = graphUrl('/me/permissions')
  const permissions = await requestCollection(
    url,
    permissionSchema,
    'meta_marketing_permissions_request',
    options,
    accessToken,
  )
  const granted = permissions
    .filter((entry) => entry.status.toLowerCase() === 'granted')
    .map((entry) => entry.permission)

  if (!META_MARKETING_OAUTH_SCOPES.every((scope) => granted.includes(scope))) {
    throw new MetaMarketingOAuthError('meta_marketing_required_scopes_missing', 403)
  }
  return granted
}

export async function fetchMetaMarketingBusinesses(
  accessToken: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<MetaMarketingBusiness[]> {
  const businessesUrl = graphUrl('/me/businesses')
  businessesUrl.searchParams.set('fields', 'id,name')
  businessesUrl.searchParams.set('limit', '100')
  const businesses = await requestCollection(
    businessesUrl,
    businessSchema,
    'meta_marketing_businesses_request',
    options,
    accessToken,
  )

  return Promise.all(businesses.slice(0, MAX_BUSINESSES).map(async (business) => {
    const [owned, client] = await Promise.all([
      fetchBusinessAdAccounts(business.id, 'owned_ad_accounts', accessToken, options),
      fetchBusinessAdAccounts(business.id, 'client_ad_accounts', accessToken, options),
    ])
    return {
      ...business,
      adAccounts: dedupeAdAccounts([...owned, ...client]),
    }
  }))
}

async function fetchBusinessAdAccounts(
  businessId: string,
  edge: 'owned_ad_accounts' | 'client_ad_accounts',
  accessToken: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number },
) {
  const url = graphUrl(`/${encodeURIComponent(businessId)}/${edge}`)
  url.searchParams.set('fields', 'id,name,currency,account_status,timezone_name')
  url.searchParams.set('limit', '100')
  return requestCollection(
    url,
    adAccountSchema,
    `meta_marketing_${edge}_request`,
    options,
    accessToken,
  )
}

async function requestCollection<T>(
  initialUrl: URL,
  itemSchema: z.ZodType<T>,
  operation: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number },
  accessToken: string,
) {
  const result: T[] = []
  let url: URL | null = initialUrl
  let page = 0
  const schema = z.object({
    data: z.array(itemSchema),
    paging: z.object({ next: z.url().optional() }).optional(),
  })

  while (url && page < MAX_GRAPH_PAGES) {
    const payload: { data: T[]; paging?: { next?: string } } = await requestJson(
      url,
      schema,
      operation,
      options,
      accessToken,
    )
    result.push(...payload.data)
    url = payload.paging?.next ? safeGraphNextUrl(payload.paging.next) : null
    page += 1
  }
  return result
}

async function requestJson<T>(
  url: URL,
  schema: z.ZodType<T>,
  operation: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number },
  accessToken?: string,
): Promise<T> {
  let response: Response
  try {
    response = await (options.fetcher ?? fetch)(url, {
      method: 'GET',
      headers: accessToken ? { Authorization: `Bearer ${requireIdentifier(accessToken)}` } : undefined,
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    })
  } catch {
    throw new MetaMarketingOAuthError('meta_marketing_network_error')
  }

  if (!response.ok) {
    throw new MetaMarketingOAuthError(`${operation}_http_${response.status}`, response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new MetaMarketingOAuthError(`${operation}_invalid_response`, response.status)
  }
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    throw new MetaMarketingOAuthError(`${operation}_invalid_response`, response.status)
  }
  return parsed.data
}

function graphUrl(path: string) {
  const version = getMetaMarketingOAuthConfig().graphVersion
  return new URL(`https://graph.facebook.com/${version}${path}`)
}

function safeGraphNextUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.hostname !== 'graph.facebook.com') {
    throw new MetaMarketingOAuthError('meta_marketing_pagination_url_invalid')
  }
  url.searchParams.delete('access_token')
  return url
}

function dedupeAdAccounts(accounts: MetaMarketingAdAccount[]) {
  return [...new Map(accounts.map((account) => [account.id, account])).values()]
}

function signState(encodedPayload: string) {
  const secret = process.env.META_MARKETING_OAUTH_STATE_SECRET
  if (!secret || secret.length < 32) {
    throw new MetaMarketingOAuthError('meta_marketing_oauth_state_secret_missing')
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
  if (!normalized || normalized.length > 1000) {
    throw new MetaMarketingOAuthError('meta_marketing_oauth_input_invalid')
  }
  return normalized
}

function isMetaMarketingOAuthState(value: unknown): value is MetaMarketingOAuthState {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return record.provider === 'meta_marketing'
    && typeof record.tenantId === 'string'
    && record.tenantId.length > 0
    && typeof record.userId === 'string'
    && record.userId.length > 0
    && typeof record.nonce === 'string'
    && record.nonce.length > 0
    && typeof record.exp === 'number'
    && Number.isFinite(record.exp)
}

function normalizeGraphApiVersion(value: string | undefined) {
  return /^v\d+\.\d+$/.test(value ?? '') ? value! : 'v26.0'
}
