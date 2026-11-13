import { isIP } from 'node:net'
import { normalizeKnowledgeSourceUrl } from './source-url'

export const MANAGED_WEB_SOURCE_TYPES = ['url', 'sitemap', 'website'] as const
export const KNOWLEDGE_REFRESH_INTERVALS = ['manual', 'daily', 'weekly', 'monthly'] as const

export type ManagedWebSourceType = typeof MANAGED_WEB_SOURCE_TYPES[number]
export type KnowledgeRefreshInterval = typeof KNOWLEDGE_REFRESH_INTERVALS[number]

type ManagedWebSourceInput = {
  name: unknown
  sourceType: unknown
  sourceUrl: unknown
  refreshInterval: unknown
  authorizedHosts: string[]
}

type ManagedWebSourceValidation =
  | {
    ok: true
    data: {
      name: string
      sourceType: ManagedWebSourceType
      sourceUrl: string
      originalUrl: string
      refreshInterval: KnowledgeRefreshInterval
    }
  }
  | { ok: false; error: string }

export function validateManagedWebSourceInput(input: ManagedWebSourceInput): ManagedWebSourceValidation {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (name.length < 2 || name.length > 120) {
    return { ok: false, error: 'El nombre debe tener entre 2 y 120 caracteres.' }
  }

  if (!isManagedWebSourceType(input.sourceType)) {
    return { ok: false, error: 'Selecciona un tipo de fuente web válido.' }
  }

  if (!isKnowledgeRefreshInterval(input.refreshInterval)) {
    return { ok: false, error: 'Selecciona una frecuencia de actualización válida.' }
  }

  const originalUrl = typeof input.sourceUrl === 'string' ? input.sourceUrl.trim() : ''
  if (!originalUrl || originalUrl.length > 2048) {
    return { ok: false, error: 'Introduce una URL válida de hasta 2048 caracteres.' }
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(originalUrl)
  } catch {
    return { ok: false, error: 'La URL debe incluir http:// o https://.' }
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    return { ok: false, error: 'La fuente debe ser una URL pública HTTP(S) sin credenciales.' }
  }

  if (isPrivateHostname(parsedUrl.hostname)) {
    return { ok: false, error: 'No se permiten direcciones locales o de red privada.' }
  }

  const authorizedHosts = new Set(input.authorizedHosts.map(normalizeHost).filter(Boolean))
  if (!authorizedHosts.has(normalizeHost(parsedUrl.host))) {
    return { ok: false, error: 'La URL debe pertenecer a un dominio autorizado del espacio.' }
  }

  const normalizedUrl = normalizeKnowledgeSourceUrl(originalUrl)
  if (!normalizedUrl) {
    return { ok: false, error: 'No se pudo normalizar la URL de la fuente.' }
  }

  return {
    ok: true,
    data: {
      name,
      sourceType: input.sourceType,
      sourceUrl: normalizedUrl,
      originalUrl,
      refreshInterval: input.refreshInterval,
    },
  }
}

export function getNextKnowledgeSyncAt(interval: KnowledgeRefreshInterval, from: Date) {
  if (interval === 'manual') return null

  const next = new Date(from)
  if (interval === 'daily') next.setUTCDate(next.getUTCDate() + 1)
  if (interval === 'weekly') next.setUTCDate(next.getUTCDate() + 7)
  if (interval === 'monthly') {
    const originalDay = next.getUTCDate()
    next.setUTCDate(1)
    next.setUTCMonth(next.getUTCMonth() + 1)
    const finalTargetMonthDay = new Date(Date.UTC(
      next.getUTCFullYear(),
      next.getUTCMonth() + 1,
      0,
    )).getUTCDate()
    next.setUTCDate(Math.min(originalDay, finalTargetMonthDay))
  }
  return next
}

export function isManagedWebSourceType(value: unknown): value is ManagedWebSourceType {
  return MANAGED_WEB_SOURCE_TYPES.includes(value as ManagedWebSourceType)
}

export function isKnowledgeRefreshInterval(value: unknown): value is KnowledgeRefreshInterval {
  return KNOWLEDGE_REFRESH_INTERVALS.includes(value as KnowledgeRefreshInterval)
}

function normalizeHost(value: string) {
  const host = value.trim().toLowerCase().replace(/^www\./, '')
  if (!host) return ''

  try {
    const parsed = new URL(`https://${host}`)
    const port = parsed.port && parsed.port !== '443' ? `:${parsed.port}` : ''
    return `${parsed.hostname.replace(/^www\./, '')}${port}`
  } catch {
    return host
  }
}

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true

  const ipVersion = isIP(host)
  if (ipVersion === 4) return isPrivateIpv4(host)
  if (ipVersion === 6) {
    return host === '::1'
      || host === '::'
      || host.startsWith('fc')
      || host.startsWith('fd')
      || /^fe[89ab]/.test(host)
  }

  return false
}

function isPrivateIpv4(host: string) {
  const [a, b] = host.split('.').map(Number)
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224
}

export type ManagedWebSourceScope = {
  includePaths: string[]
  excludePaths: string[]
}

const MAX_SCOPE_RULES = 20
const MAX_SCOPE_RULE_LENGTH = 200
const SCOPE_RULE_PATTERN = /^\/[A-Za-z0-9\-._~%!$&'()+,;=:@/*]*$/

/**
 * Path scope of a managed website/sitemap source, stored as
 * `config.include_paths` / `config.exclude_paths` and applied by talia-ai's
 * crawler. One path per line (or comma separated), `*` within a segment.
 * A website source that starts below the root (e.g. `/programacio/`) is kept
 * inside that path unless the venue lists other paths explicitly, so old
 * show pages elsewhere on the site are not crawled.
 */
export function parseManagedWebSourceScope(input: {
  sourceType: ManagedWebSourceType
  sourceUrl: string
  includePaths: unknown
  excludePaths: unknown
}): { ok: true; scope: ManagedWebSourceScope } | { ok: false; error: string } {
  if (input.sourceType === 'url') return { ok: true, scope: { includePaths: [], excludePaths: [] } }

  const include = parseScopeRules(input.includePaths)
  if (!include.ok) return include
  const exclude = parseScopeRules(input.excludePaths)
  if (!exclude.ok) return exclude

  let includePaths = include.rules
  if (!includePaths.length && input.sourceType === 'website') {
    const startPath = normalizeScopeRule(new URL(input.sourceUrl).pathname)
    if (startPath !== '/') includePaths = [startPath]
  }

  return { ok: true, scope: { includePaths, excludePaths: exclude.rules } }
}

function parseScopeRules(value: unknown): { ok: true; rules: string[] } | { ok: false; error: string } {
  const raw = typeof value === 'string' ? value : ''
  const entries = raw.split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean)
  const rules = new Set<string>()
  for (const entry of entries) {
    if (entry.length > MAX_SCOPE_RULE_LENGTH || !SCOPE_RULE_PATTERN.test(entry)) {
      return { ok: false, error: `La ruta «${entry.slice(0, 60)}» no es válida: debe empezar por / (por ejemplo /programacio).` }
    }
    rules.add(normalizeScopeRule(entry))
  }
  if (rules.size > MAX_SCOPE_RULES) {
    return { ok: false, error: `Indica como máximo ${MAX_SCOPE_RULES} rutas por lista.` }
  }
  return { ok: true, rules: [...rules] }
}

function normalizeScopeRule(path: string) {
  return path.toLowerCase().replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/'
}
