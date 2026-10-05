import crypto from 'node:crypto'
import type { Json } from '@/types/database.types'
import { z } from 'zod'

const encryptedPayloadSchema = z.object({
  alg: z.literal('aes-256-gcm'),
  iv: z.string().min(1),
  tag: z.string().min(1),
  ciphertext: z.string().min(1),
})

const credentialsSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.string().min(1).optional(),
  expiresAt: z.string().datetime({ offset: true }),
})

export type MetaMarketingCredentials = z.infer<typeof credentialsSchema>

export function encryptMetaMarketingPayload(value: unknown, purpose: string) {
  const key = getMetaMarketingEncryptionKey(purpose)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ])
  return {
    alg: 'aes-256-gcm' as const,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  }
}

export function decryptMetaMarketingPayload(value: unknown, purpose: string) {
  const encrypted = encryptedPayloadSchema.parse(value)
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getMetaMarketingEncryptionKey(purpose),
    Buffer.from(encrypted.iv, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64url'))
  return JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8')) as unknown
}

export function buildMetaMarketingCredentialMetadata(credentials: MetaMarketingCredentials): Json {
  const validated = credentialsSchema.parse(credentials)
  return {
    encrypted_credentials: encryptMetaMarketingPayload(validated, 'stored-credentials'),
    expires_at: validated.expiresAt,
    token_type: validated.tokenType ?? 'bearer',
  }
}

function getMetaMarketingEncryptionKey(purpose: string) {
  const secret = process.env.META_MARKETING_TOKEN_ENCRYPTION_KEY
  if (!secret || secret.length < 32) {
    throw new Error('meta_marketing_encryption_key_missing')
  }
  return crypto.createHash('sha256').update(`meta-marketing:${purpose}:${secret}`).digest()
}
