import crypto from 'node:crypto'

type CaptureTokenPayload = {
  tenantId: string
  sourceId: string
  url: string
  exp: number
}

type CaptureBatchTokenPayload = {
  tenantId: string
  sourceIds: string[]
  exp: number
}

const DEFAULT_CAPTURE_TOKEN_TTL_SECONDS = 24 * 60 * 60
const CAPTURE_TOKEN_CLOCK_TOLERANCE_SECONDS = 60

export function createWebCaptureToken(input: {
  tenantId: string
  sourceId: string
  url: string
  expiresInSeconds?: number
}) {
  const payload: CaptureTokenPayload = {
    tenantId: input.tenantId,
    sourceId: input.sourceId,
    url: input.url,
    exp: Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? getDefaultTokenTtlSeconds()),
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${sign(encodedPayload)}`
}

export function createWebCaptureBatchToken(input: {
  tenantId: string
  sourceIds: string[]
  expiresInSeconds?: number
}) {
  const payload: CaptureBatchTokenPayload = {
    tenantId: input.tenantId,
    sourceIds: input.sourceIds,
    exp: Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? getDefaultTokenTtlSeconds()),
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${sign(encodedPayload)}`
}

export function verifyWebCaptureToken(token: string) {
  const parsed = verifySignedPayload<Partial<CaptureTokenPayload>>(token, 'invalid_capture_token')

  if (!parsed.tenantId || !parsed.sourceId || !parsed.url || !parsed.exp) {
    throw new Error('invalid_capture_token')
  }
  if (parsed.exp + CAPTURE_TOKEN_CLOCK_TOLERANCE_SECONDS < Math.floor(Date.now() / 1000)) {
    throw new Error('expired_capture_token')
  }

  return parsed as CaptureTokenPayload
}

export function verifyWebCaptureBatchToken(token: string) {
  const parsed = verifySignedPayload<Partial<CaptureBatchTokenPayload>>(token, 'invalid_capture_batch_token')

  if (!parsed.tenantId || !Array.isArray(parsed.sourceIds) || !parsed.sourceIds.length || !parsed.exp) {
    throw new Error('invalid_capture_batch_token')
  }
  if (parsed.sourceIds.some((sourceId) => typeof sourceId !== 'string' || !sourceId)) {
    throw new Error('invalid_capture_batch_token')
  }
  if (parsed.exp + CAPTURE_TOKEN_CLOCK_TOLERANCE_SECONDS < Math.floor(Date.now() / 1000)) {
    throw new Error('expired_capture_batch_token')
  }

  return parsed as CaptureBatchTokenPayload
}

function verifySignedPayload<T>(token: string, invalidError: string) {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) throw new Error(invalidError)

  const expectedSignature = sign(encodedPayload)
  if (!timingSafeEqual(signature, expectedSignature)) throw new Error(invalidError)

  return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as T
}

function sign(encodedPayload: string) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(encodedPayload)
    .digest('base64url')
}

function getSecret() {
  const secret = process.env.WEB_CAPTURE_TOKEN_SECRET
    ?? process.env.INTERNAL_API_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!secret) throw new Error('missing_web_capture_token_secret')
  return secret
}

function getDefaultTokenTtlSeconds() {
  const configured = Number.parseInt(process.env.WEB_CAPTURE_TOKEN_TTL_SECONDS ?? '', 10)
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_CAPTURE_TOKEN_TTL_SECONDS
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}
