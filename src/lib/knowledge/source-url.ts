const TRACKING_QUERY_PARAMETERS = new Set([
  '_ga',
  '_gl',
  'dclid',
  'fbclid',
  'gclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'msclkid',
  'ttclid',
  'twclid',
  'yclid',
])

export function normalizeKnowledgeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

    url.hash = ''
    url.hostname = url.hostname.toLowerCase()
    if (url.hostname.startsWith('www.')) url.hostname = url.hostname.slice(4)
    if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
      url.port = ''
    }
    url.pathname = url.pathname.replace(/\/+$/, '') || '/'

    for (const key of [...url.searchParams.keys()]) {
      const normalizedKey = key.toLowerCase()
      if (normalizedKey.startsWith('utm_') || TRACKING_QUERY_PARAMETERS.has(normalizedKey)) {
        url.searchParams.delete(key)
      }
    }

    url.searchParams.sort()
    return url.toString()
  } catch {
    return null
  }
}

export function normalizeInstalledPageUrl(value: string): string | null {
  const normalized = normalizeKnowledgeSourceUrl(value)
  if (!normalized) return null

  const url = new URL(normalized)
  for (const key of new Set(url.searchParams.keys())) {
    if (url.searchParams.getAll(key).every((queryValue) => !queryValue.trim())) {
      url.searchParams.delete(key)
    }
  }

  url.searchParams.sort()
  return url.toString()
}
