import type { Json } from '@/types/database.types'

export const OWNER_AUTHORIZED_CAPTURE_KEY = 'owner_authorized_capture'
export const WIDGET_INSTALLATION_VERIFICATION_MAX_AGE_MS = 24 * 60 * 60 * 1000

export type WidgetInstallationEvidence = {
  origin: string
  lastSeenAt: string
}

export type OwnerAuthorizedWebCapture = {
  enabled: boolean
  verificationMethod: 'installed_widget'
  authorizedOrigin: string
  verifiedAt: string
  authorizedAt: string
  authorizedBy: string
  revokedAt: string | null
  revokedBy: string | null
}

export function findFreshWidgetInstallation(
  sourceUrl: string,
  installations: WidgetInstallationEvidence[],
  now = new Date(),
) {
  const sourceOrigin = normalizeComparableOrigin(sourceUrl)
  if (!sourceOrigin) return null

  const oldestAccepted = now.getTime() - WIDGET_INSTALLATION_VERIFICATION_MAX_AGE_MS
  return installations.find((installation) => {
    const lastSeenAt = Date.parse(installation.lastSeenAt)
    return Number.isFinite(lastSeenAt)
      && lastSeenAt >= oldestAccepted
      && lastSeenAt <= now.getTime() + 5 * 60 * 1000
      && normalizeComparableOrigin(installation.origin) === sourceOrigin
  }) ?? null
}

export function getOwnerAuthorizedWebCapture(
  config: unknown,
  sourceUrl: string,
): OwnerAuthorizedWebCapture | null {
  if (!isRecord(config)) return null
  const value = config[OWNER_AUTHORIZED_CAPTURE_KEY]
  if (!isRecord(value)) return null

  const verificationMethod = value.verification_method
  const authorizedOrigin = readString(value.authorized_origin)
  const verifiedAt = readString(value.verified_at)
  const authorizedAt = readString(value.authorized_at)
  const authorizedBy = readString(value.authorized_by)
  if (
    typeof value.enabled !== 'boolean'
    || verificationMethod !== 'installed_widget'
    || !authorizedOrigin
    || !verifiedAt
    || !authorizedAt
    || !authorizedBy
    || normalizeComparableOrigin(authorizedOrigin) !== normalizeComparableOrigin(sourceUrl)
  ) {
    return null
  }

  return {
    enabled: value.enabled,
    verificationMethod,
    authorizedOrigin,
    verifiedAt,
    authorizedAt,
    authorizedBy,
    revokedAt: readString(value.revoked_at),
    revokedBy: readString(value.revoked_by),
  }
}

export function withOwnerAuthorizedWebCapture(
  config: unknown,
  input: {
    enabled: boolean
    sourceUrl: string
    actorUserId: string
    installation?: WidgetInstallationEvidence
    now?: Date
  },
): Json {
  const currentConfig = isRecord(config) ? config : {}
  const current = getOwnerAuthorizedWebCapture(currentConfig, input.sourceUrl)
  const effectiveNow = input.now ?? new Date()
  const now = effectiveNow.toISOString()

  if (input.enabled) {
    if (!input.installation || !findFreshWidgetInstallation(input.sourceUrl, [input.installation], effectiveNow)) {
      throw new Error('fresh_widget_installation_required')
    }
    return {
      ...currentConfig,
      [OWNER_AUTHORIZED_CAPTURE_KEY]: {
        enabled: true,
        verification_method: 'installed_widget',
        authorized_origin: input.installation.origin,
        verified_at: input.installation.lastSeenAt,
        authorized_at: now,
        authorized_by: input.actorUserId,
        revoked_at: null,
        revoked_by: null,
      },
    } as Json
  }

  if (!current) return currentConfig as Json
  return {
    ...currentConfig,
    [OWNER_AUTHORIZED_CAPTURE_KEY]: {
      enabled: false,
      verification_method: current.verificationMethod,
      authorized_origin: current.authorizedOrigin,
      verified_at: current.verifiedAt,
      authorized_at: current.authorizedAt,
      authorized_by: current.authorizedBy,
      revoked_at: now,
      revoked_by: input.actorUserId,
    },
  } as Json
}

function normalizeComparableOrigin(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    const port = url.port && !isDefaultPort(url) ? `:${url.port}` : ''
    return `${url.protocol}//${hostname}${port}`
  } catch {
    return null
  }
}

function isDefaultPort(url: URL) {
  return (url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}
