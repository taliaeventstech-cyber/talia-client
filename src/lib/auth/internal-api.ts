import { matchesServerSecret, MIN_SERVER_SECRET_LENGTH } from './server-secret'

export type InternalApiAuthorization =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string }

export function authorizeInternalApiRequest(providedKey: string | null): InternalApiAuthorization {
  const expectedKey = process.env.INTERNAL_API_KEY

  if (!expectedKey || expectedKey.length < MIN_SERVER_SECRET_LENGTH) {
    return { ok: false, status: 503, error: 'Internal API unavailable' }
  }

  if (!matchesServerSecret(providedKey, expectedKey)) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  return { ok: true }
}
