const MAX_EMAIL_ADDRESS_LENGTH = 254
const MAX_LOCAL_PART_LENGTH = 64
const LOCAL_PART_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i
const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

/**
 * Returns one conservative mailbox address or null. Provider-controlled header
 * values must never be allowed to expand a supervised draft to extra recipients.
 */
export function normalizeSingleEmailAddress(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  if (!normalized || normalized.length > MAX_EMAIL_ADDRESS_LENGTH) return null
  if (/[\r\n,;<>]/.test(normalized)) return null

  const parts = normalized.split('@')
  if (parts.length !== 2) return null
  const [localPart, domain] = parts
  if (!localPart || localPart.length > MAX_LOCAL_PART_LENGTH || !LOCAL_PART_PATTERN.test(localPart)) return null
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) return null

  const labels = domain?.split('.') ?? []
  if (labels.length < 2 || labels.some((label) => !DOMAIN_LABEL_PATTERN.test(label))) return null

  return normalized
}
