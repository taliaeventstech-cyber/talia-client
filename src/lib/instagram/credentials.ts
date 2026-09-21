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

const instagramCredentialsSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.string().min(1).optional(),
  expiresAt: z.string().datetime(),
})

const storedCredentialSchema = z.object({
  credential_metadata: z.record(z.string(), z.unknown()),
})

export type InstagramCredentials = z.infer<typeof instagramCredentialsSchema>

export function encryptInstagramCredentials(credentials: InstagramCredentials) {
  const validated = instagramCredentialsSchema.parse(credentials)
  const key = getInstagramEncryptionKey()
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

export function decryptInstagramCredentials(value: unknown): InstagramCredentials {
  const encrypted = encryptedCredentialsSchema.parse(value)
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getInstagramEncryptionKey(),
    Buffer.from(encrypted.iv, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64url'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64url')),
    decipher.final(),
  ])

  return instagramCredentialsSchema.parse(JSON.parse(plaintext.toString('utf8')))
}

export function buildInstagramCredentialMetadata(credentials: InstagramCredentials): Json {
  return {
    encrypted_credentials: encryptInstagramCredentials(credentials),
    expires_at: credentials.expiresAt,
    token_type: credentials.tokenType ?? 'bearer',
  }
}

export async function getInstagramConnectionAccessToken(
  admin: AdminClient,
  input: { tenantId: string; instagramUserId: string },
) {
  const { data, error } = await admin.rpc('get_instagram_connection_credentials', {
    p_theatre_id: input.tenantId,
    p_instagram_user_id: input.instagramUserId,
  })
  if (error) throw new Error('instagram_connection_credentials_load_failed')

  const stored = storedCredentialSchema.safeParse(data)
  if (!stored.success) throw new Error('instagram_connection_credentials_unavailable')

  return decryptInstagramCredentials(
    stored.data.credential_metadata.encrypted_credentials,
  ).accessToken
}

function getInstagramEncryptionKey() {
  const secret = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY
  if (!secret || secret.length < 32) {
    throw new Error('Missing dedicated Instagram token encryption key; configure at least 32 random characters')
  }
  return crypto.createHash('sha256').update(secret).digest()
}
