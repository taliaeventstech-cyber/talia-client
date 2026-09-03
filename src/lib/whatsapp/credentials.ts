import crypto from 'node:crypto'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'
import { z } from 'zod'

type AdminClient = ReturnType<typeof createAdminClient>

const encryptedCredentialsSchema = z.object({
  alg: z.literal('aes-256-gcm'),
  iv: z.string().min(1),
  tag: z.string().min(1),
  ciphertext: z.string().min(1),
})

const whatsappCredentialsSchema = z.object({
  accessToken: z.string().min(1),
  twoStepPin: z.string().regex(/^\d{6}$/),
  tokenType: z.string().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
})

const storedCredentialSchema = z.object({
  credential_source: z.enum(['environment', 'encrypted']),
  credential_metadata: z.record(z.string(), z.unknown()),
})

export type WhatsappCredentials = z.infer<typeof whatsappCredentialsSchema>

export function encryptWhatsappCredentials(credentials: WhatsappCredentials) {
  const validated = whatsappCredentialsSchema.parse(credentials)
  const key = getWhatsappEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(validated), 'utf8'),
    cipher.final(),
  ])

  return {
    alg: 'aes-256-gcm' as const,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  }
}

export function decryptWhatsappCredentials(value: unknown): WhatsappCredentials {
  const encrypted = encryptedCredentialsSchema.parse(value)
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getWhatsappEncryptionKey(),
    Buffer.from(encrypted.iv, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64url'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64url')),
    decipher.final(),
  ])

  return whatsappCredentialsSchema.parse(JSON.parse(plaintext.toString('utf8')))
}

export function buildWhatsappCredentialMetadata(credentials: WhatsappCredentials): Json {
  return {
    encrypted_credentials: encryptWhatsappCredentials(credentials),
    expires_at: credentials.expiresAt ?? null,
    token_type: credentials.tokenType ?? null,
  }
}

export async function getWhatsappConnectionAccessToken(
  admin: AdminClient,
  input: { tenantId: string; phoneNumberId: string },
) {
  const { data, error } = await admin.rpc('get_whatsapp_connection_credentials', {
    p_theatre_id: input.tenantId,
    p_phone_number_id: input.phoneNumberId,
  })
  if (error) throw new Error('whatsapp_connection_credentials_load_failed')

  const stored = storedCredentialSchema.safeParse(data)
  if (!stored.success) throw new Error('whatsapp_connection_credentials_unavailable')

  if (stored.data.credential_source === 'environment') {
    const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN
    if (!accessToken) throw new Error('whatsapp_environment_access_token_missing')
    return accessToken
  }

  return decryptWhatsappCredentials(stored.data.credential_metadata.encrypted_credentials).accessToken
}

function getWhatsappEncryptionKey() {
  const secret = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY
  if (!secret || secret.length < 32) {
    throw new Error('Missing dedicated WhatsApp token encryption key; configure at least 32 random characters')
  }
  return crypto.createHash('sha256').update(secret).digest()
}
