import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

type DomainSettings = {
  websiteUrl: string | null
  widgetConfig: unknown
}

type DomainValidationInput = DomainSettings & {
  request: Request
  pageUrl?: string | null
  allowMissingOrigin?: boolean
}

type DomainValidationResult =
  | {
    ok: true
    requestHost: string | null
    pageHost: string | null
    authorizedHosts: string[]
  }
  | {
    ok: false
    error: 'domain_not_allowed' | 'invalid_page_url'
    requestHost: string | null
    pageHost: string | null
    authorizedHosts: string[]
  }

const WIDGET_CONFIG_DOMAIN_KEYS = [
  'allowedDomains',
  'allowed_domains',
  'allowedOrigins',
  'allowed_origins',
  'siteOrigins',
  'site_origins',
  'siteOrigin',
  'site_origin',
] as const

export async function getTenantWidgetDomainSettings(admin: AdminClient, tenantId: string) {
  const { data, error } = await admin
    .from('theatres')
    .select('website_url, widget_config')
    .eq('id', tenantId)
    .maybeSingle()

  if (error || !data) {
    return { ok: false as const, error: error?.message ?? 'Tenant not found' }
  }

  return {
    ok: true as const,
    settings: {
      websiteUrl: data.website_url,
      widgetConfig: data.widget_config,
    } satisfies DomainSettings,
  }
}

export function validateWidgetRequestDomain(input: DomainValidationInput): DomainValidationResult {
  const authorizedHosts = uniqueStrings([
    ...getAuthorizedWidgetHosts(input),
    hostFromUrl(input.request.url),
  ])
  const pageHost = input.pageUrl ? hostFromUrl(input.pageUrl) : null
  if (input.pageUrl && !pageHost) {
    return {
      ok: false,
      error: 'invalid_page_url',
      requestHost: getRequestHost(input.request),
      pageHost: null,
      authorizedHosts,
    }
  }

  const requestHost = getRequestHost(input.request)
  if (!requestHost && input.allowMissingOrigin !== true) {
    return {
      ok: false,
      error: 'domain_not_allowed',
      requestHost,
      pageHost,
      authorizedHosts,
    }
  }

  if (!authorizedHosts.length) {
    return {
      ok: false,
      error: 'domain_not_allowed',
      requestHost,
      pageHost,
      authorizedHosts,
    }
  }

  const requestAllowed = !requestHost || hostMatchesAny(requestHost, authorizedHosts)
  const pageAllowed = !pageHost || hostMatchesAny(pageHost, authorizedHosts)
  if (!requestAllowed || !pageAllowed) {
    return {
      ok: false,
      error: 'domain_not_allowed',
      requestHost,
      pageHost,
      authorizedHosts,
    }
  }

  return {
    ok: true,
    requestHost,
    pageHost,
    authorizedHosts,
  }
}

export function getAuthorizedWidgetHosts(input: DomainSettings) {
  const hosts = [
    hostFromUrl(input.websiteUrl),
    ...getHostsFromWidgetConfig(input.widgetConfig),
    hostFromUrl(process.env.NEXT_PUBLIC_APP_URL),
    hostFromUrl(process.env.NEXT_PUBLIC_SITE_URL),
  ]

  return uniqueStrings(hosts.flatMap((host) => getHostVariants(host)))
}

export function normalizeAllowedWidgetDomains(value: string) {
  return uniqueStrings(
    value
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map(hostFromUrl)
      .flatMap((host) => getHostVariants(host))
  ).slice(0, 25)
}

function getHostsFromWidgetConfig(value: unknown) {
  if (!isRecord(value)) return []

  return WIDGET_CONFIG_DOMAIN_KEYS.flatMap((key) => {
    const rawValue = value[key]
    if (Array.isArray(rawValue)) return rawValue.map(hostFromUrl)
    return [hostFromUrl(rawValue)]
  }).filter((host): host is string => Boolean(host))
}

function getRequestHost(request: Request) {
  return hostFromUrl(request.headers.get('origin')) ?? hostFromUrl(request.headers.get('referer'))
}

function hostFromUrl(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

    const hostname = url.hostname.toLowerCase()
    const port = isDefaultPort(url) ? '' : url.port
    return port ? `${hostname}:${port}` : hostname
  } catch {
    return null
  }
}

function getHostVariants(host: string | null) {
  if (!host) return []
  if (host === 'localhost' || host.startsWith('localhost:') || /^\d+\.\d+\.\d+\.\d+(?::\d+)?$/.test(host)) {
    return [host]
  }

  const withoutWww = host.startsWith('www.') ? host.slice(4) : host
  return host.startsWith('www.')
    ? [host, withoutWww]
    : [host, `www.${host}`]
}

function hostMatchesAny(host: string, authorizedHosts: string[]) {
  return authorizedHosts.some((authorizedHost) => host === authorizedHost)
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function isDefaultPort(url: URL) {
  return !url.port || (url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
