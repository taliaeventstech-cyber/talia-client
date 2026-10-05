import { decryptMetaMarketingPayload, encryptMetaMarketingPayload } from './credentials'
import { z } from 'zod'

export const META_MARKETING_OAUTH_COOKIE = 'talia_meta_marketing_oauth'
export const META_MARKETING_OAUTH_SESSION_TTL_SECONDS = 15 * 60

const pendingSessionSchema = z.object({
  provider: z.literal('meta_marketing'),
  tenantId: z.uuid(),
  userId: z.uuid(),
  metaUserId: z.string().min(1).max(200),
  accessToken: z.string().min(1),
  tokenType: z.string().min(1).optional(),
  tokenExpiresAt: z.string().datetime({ offset: true }),
  scopes: z.array(z.string()).min(1),
  exp: z.number().int().positive(),
})

export type PendingMetaMarketingOAuthSession = z.infer<typeof pendingSessionSchema>

export function createPendingMetaMarketingOAuthSession(
  input: Omit<PendingMetaMarketingOAuthSession, 'provider' | 'exp'>,
  now = Date.now(),
) {
  const session = pendingSessionSchema.parse({
    ...input,
    provider: 'meta_marketing',
    exp: now + META_MARKETING_OAUTH_SESSION_TTL_SECONDS * 1000,
  })
  return Buffer.from(JSON.stringify(
    encryptMetaMarketingPayload(session, 'oauth-session'),
  ), 'utf8').toString('base64url')
}

export function parsePendingMetaMarketingOAuthSession(value: string, now = Date.now()) {
  let encrypted: unknown
  try {
    encrypted = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
  } catch {
    throw new Error('meta_marketing_oauth_session_invalid')
  }
  const session = pendingSessionSchema.safeParse(
    decryptMetaMarketingPayload(encrypted, 'oauth-session'),
  )
  if (!session.success || session.data.exp < now) {
    throw new Error('meta_marketing_oauth_session_expired')
  }
  return session.data
}

export function getMetaMarketingOAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: META_MARKETING_OAUTH_SESSION_TTL_SECONDS,
  }
}
