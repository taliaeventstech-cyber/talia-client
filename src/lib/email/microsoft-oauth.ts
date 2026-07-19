import crypto from 'node:crypto'
import { decryptOAuthTokens, encryptOAuthTokens, getRequiredEmailSecret } from './google-oauth'

export const MICROSOFT_GRAPH_SCOPES = [
  'openid',
  'email',
  'profile',
  'offline_access',
  'User.Read',
  'Mail.ReadWrite',
] as const

const MICROSOFT_TOKEN_ENDPOINT_BASE = 'https://login.microsoftonline.com'
const MICROSOFT_GRAPH_ME_ENDPOINT = 'https://graph.microsoft.com/v1.0/me'
const STATE_TTL_MS = 10 * 60 * 1000

type OAuthStatePayload = {
  tenantId: string
  userId: string
  nonce: string
  exp: number
}

type MicrosoftTokenResponse = {
  access_token: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  token_type?: string
}

export type MicrosoftProfile = {
  id: string
  displayName?: string
  mail?: string | null
  userPrincipalName?: string | null
}

export function getMicrosoftOAuthConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const tenant = process.env.MICROSOFT_TENANT_ID || 'common'
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  if (!clientId || !clientSecret) {
    throw new Error('Missing Microsoft OAuth credentials')
  }

  return {
    clientId,
    clientSecret,
    tenant,
    authorizationEndpoint: `${MICROSOFT_TOKEN_ENDPOINT_BASE}/${tenant}/oauth2/v2.0/authorize`,
    tokenEndpoint: `${MICROSOFT_TOKEN_ENDPOINT_BASE}/${tenant}/oauth2/v2.0/token`,
    redirectUri: `${appUrl}/api/email/microsoft/callback`,
  }
}

export function getMicrosoftAuthorizationUrl(input: { tenantId: string; userId: string }) {
  const config = getMicrosoftOAuthConfig()
  const url = new URL(config.authorizationEndpoint)

  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('response_mode', 'query')
  url.searchParams.set('scope', MICROSOFT_GRAPH_SCOPES.join(' '))
  url.searchParams.set('prompt', 'select_account')
  url.searchParams.set('state', createMicrosoftOAuthState(input))

  return url
}

export function createMicrosoftOAuthState(input: { tenantId: string; userId: string }) {
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

export function verifyMicrosoftOAuthState(state: string) {
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

export async function exchangeMicrosoftCodeForTokens(code: string) {
  const config = getMicrosoftOAuthConfig()
  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    throw new Error(`Microsoft token exchange failed: ${await response.text()}`)
  }

  return response.json() as Promise<MicrosoftTokenResponse>
}

export async function refreshMicrosoftAccessToken(refreshToken: string) {
  const config = getMicrosoftOAuthConfig()
  const response = await fetch(config.tokenEndpoint, {
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
    throw new Error(`Microsoft token refresh failed: ${await response.text()}`)
  }

  return response.json() as Promise<MicrosoftTokenResponse>
}

export async function fetchMicrosoftProfile(accessToken: string) {
  const url = new URL(MICROSOFT_GRAPH_ME_ENDPOINT)
  url.searchParams.set('$select', 'id,displayName,mail,userPrincipalName')
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Microsoft profile request failed: ${await response.text()}`)
  }

  return response.json() as Promise<MicrosoftProfile>
}

export { decryptOAuthTokens, encryptOAuthTokens }

function signState(encodedPayload: string) {
  const secret = getRequiredEmailSecret(
    'EMAIL_OAUTH_STATE_SECRET',
    'Missing dedicated email OAuth state secret',
  )

  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}
