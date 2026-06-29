import crypto from 'node:crypto'

type CaptureTokenPayload = {
  tenantId: string
  sourceId: string
  url: string
  exp: number
}

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
    exp: Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? 10 * 60),
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${sign(encodedPayload)}`
}

export function verifyWebCaptureToken(token: string) {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) throw new Error('invalid_capture_token')

  const expectedSignature = sign(encodedPayload)
  if (!timingSafeEqual(signature, expectedSignature)) throw new Error('invalid_capture_token')

  const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<CaptureTokenPayload>
  if (!parsed.tenantId || !parsed.sourceId || !parsed.url || !parsed.exp) {
    throw new Error('invalid_capture_token')
  }
  if (parsed.exp < Math.floor(Date.now() / 1000)) throw new Error('expired_capture_token')

  return parsed as CaptureTokenPayload
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

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}
