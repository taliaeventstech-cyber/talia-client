import { z } from 'zod'

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().int().positive().optional(),
})

const phoneNumbersResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string().min(1),
    display_phone_number: z.string().nullable().optional(),
    verified_name: z.string().nullable().optional(),
  })),
})

export type MetaEmbeddedSignupToken = z.infer<typeof tokenResponseSchema>
export type MetaWhatsappPhone = z.infer<typeof phoneNumbersResponseSchema>['data'][number]

export class MetaEmbeddedSignupError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number | null = null,
  ) {
    super(code)
    this.name = 'MetaEmbeddedSignupError'
  }
}

export async function exchangeMetaEmbeddedSignupCode(
  code: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<MetaEmbeddedSignupToken> {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) throw new MetaEmbeddedSignupError('meta_app_configuration_missing')

  const url = graphUrl('/oauth/access_token')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('code', code)

  const response = await request(url, {
    method: 'GET',
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  }, options.fetcher)
  return parseResponse(response, tokenResponseSchema, 'meta_code_exchange')
}

export async function getMetaWhatsappPhone(
  input: { wabaId: string; phoneNumberId: string; accessToken: string },
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<MetaWhatsappPhone> {
  const url = graphUrl(`/${encodeURIComponent(input.wabaId)}/phone_numbers`)
  url.searchParams.set('fields', 'id,display_phone_number,verified_name')
  url.searchParams.set('limit', '100')
  const response = await request(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${input.accessToken}` },
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  }, options.fetcher)
  const payload = await parseResponse(response, phoneNumbersResponseSchema, 'meta_phone_validation')
  const phone = payload.data.find((candidate) => candidate.id === input.phoneNumberId)
  if (!phone) throw new MetaEmbeddedSignupError('meta_phone_not_in_selected_waba', 403)
  return phone
}

export async function subscribeMetaWhatsappApp(
  input: { wabaId: string; accessToken: string },
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const response = await request(
    graphUrl(`/${encodeURIComponent(input.wabaId)}/subscribed_apps`),
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.accessToken}` },
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    },
    options.fetcher,
  )
  await parseResponse(response, z.object({ success: z.literal(true) }), 'meta_waba_subscription')
}

export async function registerMetaWhatsappPhone(
  input: { phoneNumberId: string; accessToken: string; twoStepPin: string },
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
) {
  const response = await request(
    graphUrl(`/${encodeURIComponent(input.phoneNumberId)}/register`),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin: input.twoStepPin }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    },
    options.fetcher,
  )
  await parseResponse(response, z.object({ success: z.literal(true) }), 'meta_phone_registration')
}

function graphUrl(path: string) {
  return new URL(`https://graph.facebook.com/${normalizeGraphApiVersion(process.env.META_WHATSAPP_GRAPH_API_VERSION)}${path}`)
}

async function request(url: URL, init: RequestInit, fetcher: typeof fetch = fetch) {
  try {
    return await fetcher(url, init)
  } catch {
    throw new MetaEmbeddedSignupError('meta_network_error')
  }
}

async function parseResponse<T>(response: Response, schema: z.ZodType<T>, operation: string): Promise<T> {
  if (!response.ok) {
    throw new MetaEmbeddedSignupError(`${operation}_http_${response.status}`, response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new MetaEmbeddedSignupError(`${operation}_invalid_response`, response.status)
  }
  const parsed = schema.safeParse(payload)
  if (!parsed.success) throw new MetaEmbeddedSignupError(`${operation}_invalid_response`, response.status)
  return parsed.data
}

function normalizeGraphApiVersion(value: string | undefined) {
  return /^v\d+\.\d+$/.test(value ?? '') ? value! : 'v26.0'
}
