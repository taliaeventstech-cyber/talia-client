import crypto from 'node:crypto'

// documentId: installed page (knowledge_documents row) to capture.
type CaptureTokenPayload = {
  tenantId: string
  documentId: string
  url: string
  exp: number
}

type CaptureBatchTokenPayload = {
  tenantId: string
  documentIds: string[]
  exp: number
}

const DEFAULT_CAPTURE_TOKEN_TTL_SECONDS = 24 * 60 * 60
const CAPTURE_TOKEN_CLOCK_TOLERANCE_SECONDS = 60

export function createWebCaptureToken(input: {
  tenantId: string
  documentId: string
  url: string
  expiresInSeconds?: number
}) {
  const payload: CaptureTokenPayload = {
    tenantId: input.tenantId,
    documentId: input.documentId,
    url: input.url,
    exp: Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? getDefaultTokenTtlSeconds()),
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${sign(encodedPayload)}`
}

export function createWebCaptureBatchToken(input: {
  tenantId: string
  documentIds: string[]
  expiresInSeconds?: number
}) {
  const payload: CaptureBatchTokenPayload = {
    tenantId: input.tenantId,
    documentIds: input.documentIds,
    exp: Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? getDefaultTokenTtlSeconds()),
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${sign(encodedPayload)}`
}

export function verifyWebCaptureToken(token: string) {
  const parsed = verifySignedPayload<Partial<CaptureTokenPayload>>(token, 'invalid_capture_token')

  if (!parsed.tenantId || !parsed.documentId || !parsed.url || !parsed.exp) {
    throw new Error('invalid_capture_token')
  }
  if (parsed.exp + CAPTURE_TOKEN_CLOCK_TOLERANCE_SECONDS < Math.floor(Date.now() / 1000)) {
    throw new Error('expired_capture_token')
  }

  return parsed as CaptureTokenPayload
}

export function verifyWebCaptureBatchToken(token: string) {
  const parsed = verifySignedPayload<Partial<CaptureBatchTokenPayload>>(token, 'invalid_capture_batch_token')

  if (!parsed.tenantId || !Array.isArray(parsed.documentIds) || !parsed.documentIds.length || !parsed.exp) {
    throw new Error('invalid_capture_batch_token')
  }
  if (parsed.documentIds.some((documentId) => typeof documentId !== 'string' || !documentId)) {
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
