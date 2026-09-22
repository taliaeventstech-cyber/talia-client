import type { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import {
  exchangeInstagramAuthorizationCode,
  exchangeInstagramLongLivedToken,
  fetchInstagramProfessionalProfile,
  INSTAGRAM_OAUTH_SCOPES,
  subscribeInstagramMessagingWebhooks,
} from './oauth'
import {
  buildInstagramCredentialMetadata,
  type InstagramCredentials,
} from './credentials'

type AdminClient = ReturnType<typeof createAdminClient>

const connectionSummarySchema = z.object({
  id: z.uuid(),
  status: z.enum(['connected', 'error', 'revoked', 'disabled']),
  username: z.string().min(1),
  account_type: z.enum(['business', 'creator']),
  rollout_enabled: z.boolean(),
  connected_at: z.string().datetime({ offset: true }).nullable(),
  token_expires_at: z.string().datetime({ offset: true }).nullable(),
  updated_at: z.string().datetime({ offset: true }),
})

export type InstagramConnectionSummary = z.infer<typeof connectionSummarySchema>

type OAuthDependencies = {
  exchangeCode?: typeof exchangeInstagramAuthorizationCode
  exchangeLongLivedToken?: typeof exchangeInstagramLongLivedToken
  fetchProfile?: typeof fetchInstagramProfessionalProfile
  subscribeWebhooks?: typeof subscribeInstagramMessagingWebhooks
  now?: () => number
}

export async function completeInstagramOAuthConnection(
  admin: AdminClient,
  input: { tenantId: string; actorUserId: string; code: string },
  dependencies: OAuthDependencies = {},
) {
  const shortLived = await (dependencies.exchangeCode ?? exchangeInstagramAuthorizationCode)(input.code)
  const longLived = await (
    dependencies.exchangeLongLivedToken ?? exchangeInstagramLongLivedToken
  )(shortLived.access_token)
  const profile = await (
    dependencies.fetchProfile ?? fetchInstagramProfessionalProfile
  )(longLived.access_token)
  await (
    dependencies.subscribeWebhooks ?? subscribeInstagramMessagingWebhooks
  )(longLived.access_token)
  const expiresAt = new Date(
    (dependencies.now ?? Date.now)() + longLived.expires_in * 1000,
  ).toISOString()

  const connectionId = await saveInstagramConnection(admin, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    instagramUserId: profile.id,
    username: profile.username,
    accountType: profile.accountType,
    credentials: {
      accessToken: longLived.access_token,
      tokenType: longLived.token_type ?? 'bearer',
      expiresAt,
    },
  })

  return {
    connectionId,
    username: profile.username,
    accountType: profile.accountType,
    expiresAt,
  }
}

export async function saveInstagramConnection(
  admin: AdminClient,
  input: {
    tenantId: string
    actorUserId: string
    instagramUserId: string
    username: string
    accountType: 'business' | 'creator'
    credentials: InstagramCredentials
  },
) {
  const { data, error } = await admin.rpc('save_instagram_connection', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
    p_instagram_user_id: input.instagramUserId,
    p_username: input.username,
    p_account_type: input.accountType,
    p_scopes: [...INSTAGRAM_OAUTH_SCOPES],
    p_credential_metadata: buildInstagramCredentialMetadata(input.credentials),
  })

  const connectionId = z.uuid().safeParse(data)
  if (error || !connectionId.success) {
    throw new Error('instagram_connection_save_failed')
  }

  return connectionId.data
}

export async function getInstagramConnectionSummary(
  admin: AdminClient,
  input: { tenantId: string; actorUserId: string },
): Promise<InstagramConnectionSummary | null> {
  const { data, error } = await admin.rpc('get_instagram_connection_summary', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
  })
  if (error) throw new Error('instagram_connection_summary_failed')
  if (data === null) return null

  const parsed = connectionSummarySchema.safeParse(data)
  if (!parsed.success) throw new Error('instagram_connection_summary_invalid')
  return parsed.data
}
