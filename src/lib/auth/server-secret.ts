import crypto from 'node:crypto'

export const MIN_SERVER_SECRET_LENGTH = 32

export function matchesServerSecret(provided: string | null, expected: string | undefined) {
  if (!provided || !expected || expected.length < MIN_SERVER_SECRET_LENGTH) return false

  const providedDigest = crypto.createHash('sha256').update(provided).digest()
  const expectedDigest = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(providedDigest, expectedDigest)
}

export function getBearerToken(authorization: string | null) {
  if (!authorization?.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length).trim()
  return token || null
}
