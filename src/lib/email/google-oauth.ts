import crypto from 'node:crypto'

export const GOOGLE_GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
] as const

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'
const GMAIL_PROFILE_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/profile'
const STATE_TTL_MS = 10 * 60 * 1000

type OAuthStatePayload = {
  tenantId: string
  userId: string
  nonce: string
  exp: number
}

type GoogleTokenResponse = {
  access_token: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  token_type?: string
}

type EncryptedOAuthTokens = {
  alg: 'aes-256-gcm'
  iv: string
  tag: string
  ciphertext: string
}

export type GmailProfile = {
  emailAddress: string
  messagesTotal?: number
  threadsTotal?: number
  historyId?: string
}

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  if (!clientId || !clientSecret) {
    throw new Error('Missing Google OAuth credentials')
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/email/google/callback`,
  }
}

export function createGoogleOAuthState(input: { tenantId: string; userId: string }) {
  const payload: OAuthStatePayload = {
    tenantId: input.tenantId,
    userId: input.userId,
    nonce: crypto.randomBytes(16).toString('base64url'),
    exp: Date.now() + STATE_TTL_MS,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = signState(encodedPayload)

  return `${encodedPayload}.${signature}`
}

export function verifyGoogleOAuthState(state: string) {
  const [encodedPayload, signature] = state.split('.')
  if (!encodedPayload || !signature) {
    throw new Error('Invalid OAuth state')
  }

  const expectedSignature = signState(encodedPayload)
  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new Error('Invalid OAuth state signature')
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as OAuthStatePayload
  if (!payload.tenantId || !payload.userId || Date.now() > payload.exp) {
    throw new Error('Expired OAuth state')
  }

  return payload
}

export function getGoogleAuthorizationUrl(input: { tenantId: string; userId: string }) {
  const config = getGoogleOAuthConfig()
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT)

  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_GMAIL_SCOPES.join(' '))
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state', createGoogleOAuthState(input))

  return url
}

export async function exchangeGoogleCodeForTokens(code: string) {
  const config = getGoogleOAuthConfig()
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${await response.text()}`)
  }

  return response.json() as Promise<GoogleTokenResponse>
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const config = getGoogleOAuthConfig()
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${await response.text()}`)
  }

  return response.json() as Promise<GoogleTokenResponse>
}

export async function fetchGmailProfile(accessToken: string) {
  const response = await fetch(GMAIL_PROFILE_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Gmail profile request failed: ${await response.text()}`)
  }

  return response.json() as Promise<GmailProfile>
}

export function encryptOAuthTokens(tokens: GoogleTokenResponse) {
  const secret = getRequiredEmailSecret(
    'EMAIL_TOKEN_ENCRYPTION_KEY',
    'Missing dedicated email token encryption key',
  )

  const key = crypto.createHash('sha256').update(secret).digest()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(tokens), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  }
}

export function decryptOAuthTokens(encryptedTokens: unknown) {
  if (!isEncryptedOAuthTokens(encryptedTokens)) {
    throw new Error('Invalid encrypted OAuth tokens')
  }

  const secret = getRequiredEmailSecret(
    'EMAIL_TOKEN_ENCRYPTION_KEY',
    'Missing dedicated email token encryption key',
  )

  const key = crypto.createHash('sha256').update(secret).digest()
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(encryptedTokens.iv, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(encryptedTokens.tag, 'base64url'))

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encryptedTokens.ciphertext, 'base64url')),
    decipher.final(),
  ])

  return JSON.parse(plaintext.toString('utf8')) as GoogleTokenResponse
}

export async function revokeGoogleOAuthToken(token: string) {
  const response = await fetch(GOOGLE_REVOKE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  })

  if (!response.ok) {
    throw new Error(`Google token revocation failed: ${await response.text()}`)
  }
}

function signState(encodedPayload: string) {
  const secret = getRequiredEmailSecret(
    'EMAIL_OAUTH_STATE_SECRET',
    'Missing dedicated email OAuth state secret',
  )

  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

export function getRequiredEmailSecret(
  name: 'EMAIL_TOKEN_ENCRYPTION_KEY' | 'EMAIL_OAUTH_STATE_SECRET',
  errorMessage: string,
) {
  const secret = process.env[name]
  if (!secret || secret.length < 32) {
    throw new Error(`${errorMessage}; configure at least 32 random characters`)
  }

  return secret
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function isEncryptedOAuthTokens(value: unknown): value is EncryptedOAuthTokens {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>

  return record.alg === 'aes-256-gcm'
    && typeof record.iv === 'string'
    && typeof record.tag === 'string'
    && typeof record.ciphertext === 'string'
}
