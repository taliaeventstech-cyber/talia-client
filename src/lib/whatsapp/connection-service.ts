import crypto from 'node:crypto'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'
import { z } from 'zod'
import {
  buildWhatsappCredentialMetadata,
  decryptWhatsappCredentials,
} from './credentials'
import {
  exchangeMetaEmbeddedSignupCode,
  getMetaWhatsappPhone,
  MetaEmbeddedSignupError,
  registerMetaWhatsappPhone,
  subscribeMetaWhatsappApp,
  unsubscribeMetaWhatsappApp,
  verifyMetaWhatsappAppSubscription,
} from './embedded-signup'

type AdminClient = ReturnType<typeof createAdminClient>

export const embeddedSignupCompletionSchema = z.object({
  code: z.string().trim().min(1).max(2_000),
  businessId: z.string().trim().min(1).max(200),
  wabaId: z.string().trim().min(1).max(200),
  phoneNumberId: z.string().trim().min(1).max(200),
})

const connectionSummarySchema = z.object({
  id: z.uuid(),
  status: z.enum(['draft', 'connected', 'error', 'revoked', 'disabled']),
  display_phone_number: z.string().nullable(),
  verified_name: z.string().nullable(),
  credential_source: z.enum(['environment', 'encrypted']),
  connected_at: z.string().nullable(),
  token_expires_at: z.string().nullable(),
  last_error_code: z.string().nullable(),
  updated_at: z.string(),
})

export type WhatsappConnectionSummary = z.infer<typeof connectionSummarySchema>

type CompletionDependencies = {
  exchangeCode?: typeof exchangeMetaEmbeddedSignupCode
  getPhone?: typeof getMetaWhatsappPhone
  subscribeApp?: typeof subscribeMetaWhatsappApp
  verifyAppSubscription?: typeof verifyMetaWhatsappAppSubscription
  registerPhone?: typeof registerMetaWhatsappPhone
  now?: () => number
  createPin?: () => string
}

const disconnectContextSchema = z.object({
  id: z.uuid(),
  waba_id: z.string().min(1),
  credential_metadata: z.record(z.string(), z.unknown()),
  can_unsubscribe_provider: z.boolean(),
})

type DisconnectDependencies = {
  unsubscribeApp?: typeof unsubscribeMetaWhatsappApp
  decryptCredentials?: typeof decryptWhatsappCredentials
}

export async function getWhatsappConnectionSummary(
  admin: AdminClient,
  input: { tenantId: string; actorUserId: string },
): Promise<WhatsappConnectionSummary | null> {
  const { data, error } = await admin.rpc('get_whatsapp_connection_summary', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
  })
  if (error) throw new Error('whatsapp_connection_summary_failed')
  if (data === null) return null
  return connectionSummarySchema.parse(data)
}

export async function completeWhatsappEmbeddedSignup(
  admin: AdminClient,
  input: {
    tenantId: string
    actorUserId: string
    code: string
    businessId: string
    wabaId: string
    phoneNumberId: string
  },
  dependencies: CompletionDependencies = {},
) {
  const parsed = embeddedSignupCompletionSchema.parse(input)
  const exchangeCode = dependencies.exchangeCode ?? exchangeMetaEmbeddedSignupCode
  const getPhone = dependencies.getPhone ?? getMetaWhatsappPhone
  const subscribeApp = dependencies.subscribeApp ?? subscribeMetaWhatsappApp
  const verifyAppSubscription = dependencies.verifyAppSubscription ?? verifyMetaWhatsappAppSubscription
  const registerPhone = dependencies.registerPhone ?? registerMetaWhatsappPhone
  const now = dependencies.now ?? Date.now
  const twoStepPin = dependencies.createPin?.() ?? createTwoStepPin()

  const token = await exchangeCode(parsed.code)
  const expiresAt = token.expires_in
    ? new Date(now() + token.expires_in * 1_000).toISOString()
    : null
  const credentialMetadata = buildWhatsappCredentialMetadata({
    accessToken: token.access_token,
    twoStepPin,
    tokenType: token.token_type,
    expiresAt,
  })
  let phone = await getPhone({
    wabaId: parsed.wabaId,
    phoneNumberId: parsed.phoneNumberId,
    accessToken: token.access_token,
  })

  await saveConnection(admin, {
    ...parsed,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    displayPhoneNumber: phone.display_phone_number ?? null,
    verifiedName: phone.verified_name ?? null,
    credentialMetadata,
    status: 'draft',
  })

  try {
    await subscribeApp({ wabaId: parsed.wabaId, accessToken: token.access_token })
    await verifyAppSubscription({ wabaId: parsed.wabaId, accessToken: token.access_token })
    if (!isMetaWhatsappPhoneConnected(phone)) {
      try {
        await registerPhone({
          phoneNumberId: parsed.phoneNumberId,
          accessToken: token.access_token,
          twoStepPin,
        })
      } catch (registrationError) {
        try {
          const reconciledPhone = await getPhone({
            wabaId: parsed.wabaId,
            phoneNumberId: parsed.phoneNumberId,
            accessToken: token.access_token,
          })
          if (!isMetaWhatsappPhoneConnected(reconciledPhone)) throw registrationError
          phone = reconciledPhone
        } catch {
          throw registrationError
        }
      }
    }
    const connectionId = await saveConnection(admin, {
      ...parsed,
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      displayPhoneNumber: phone.display_phone_number ?? null,
      verifiedName: phone.verified_name ?? null,
      credentialMetadata,
      status: 'connected',
    })
    return { connectionId, displayPhoneNumber: phone.display_phone_number ?? null }
  } catch (error) {
    const errorCode = error instanceof MetaEmbeddedSignupError
      ? error.code
      : 'meta_embedded_signup_unexpected_error'
    try {
      await saveConnection(admin, {
        ...parsed,
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        displayPhoneNumber: phone.display_phone_number ?? null,
        verifiedName: phone.verified_name ?? null,
        credentialMetadata,
        status: 'error',
        errorCode,
      })
    } catch {
      // Preserve the provider failure; do not replace it with a persistence error.
    }
    throw error
  }
}

function isMetaWhatsappPhoneConnected(phone: { status?: string }) {
  return phone.status?.toUpperCase() === 'CONNECTED'
}

export async function disconnectWhatsappConnection(
  admin: AdminClient,
  input: { tenantId: string; actorUserId: string; connectionId: string },
  dependencies: DisconnectDependencies = {},
) {
  const { data, error } = await admin.rpc('get_whatsapp_connection_disconnect_context', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
    p_connection_id: input.connectionId,
  })
  if (error) throw new Error('whatsapp_connection_disconnect_context_failed')
  if (data === null) return { disconnected: false, providerWarning: false }

  const context = disconnectContextSchema.parse(data)
  const unsubscribeApp = dependencies.unsubscribeApp ?? unsubscribeMetaWhatsappApp
  const decryptCredentials = dependencies.decryptCredentials ?? decryptWhatsappCredentials
  let providerUnsubscribed = false
  let providerErrorCode: string | null = null

  if (context.can_unsubscribe_provider) {
    try {
      const credentials = decryptCredentials(context.credential_metadata.encrypted_credentials)
      await unsubscribeApp({ wabaId: context.waba_id, accessToken: credentials.accessToken })
      providerUnsubscribed = true
    } catch (providerError) {
      providerErrorCode = providerError instanceof MetaEmbeddedSignupError
        ? providerError.code
        : 'meta_waba_unsubscription_unavailable'
    }
  }

  const result = await admin.rpc('disconnect_whatsapp_connection', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
    p_connection_id: context.id,
    p_provider_unsubscribed: providerUnsubscribed,
    p_provider_error_code: providerErrorCode,
  })
  if (result.error || !result.data) throw new Error('whatsapp_connection_disconnect_failed')

  return {
    disconnected: true,
    providerWarning: providerErrorCode !== null,
  }
}

async function saveConnection(
  admin: AdminClient,
  input: {
    tenantId: string
    actorUserId: string
    businessId: string
    wabaId: string
    phoneNumberId: string
    displayPhoneNumber: string | null
    verifiedName: string | null
    credentialMetadata: Json
    status: 'draft' | 'connected' | 'error'
    errorCode?: string
  },
) {
  const { data, error } = await admin.rpc('save_whatsapp_embedded_connection', {
    p_theatre_id: input.tenantId,
    p_actor_user_id: input.actorUserId,
    p_business_id: input.businessId,
    p_waba_id: input.wabaId,
    p_phone_number_id: input.phoneNumberId,
    p_display_phone_number: input.displayPhoneNumber,
    p_verified_name: input.verifiedName,
    p_credential_metadata: input.credentialMetadata,
    p_status: input.status,
    p_error_code: input.errorCode ?? null,
  })
  if (error || !data) throw new Error('whatsapp_connection_persistence_failed')
  return data
}

function createTwoStepPin() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}
