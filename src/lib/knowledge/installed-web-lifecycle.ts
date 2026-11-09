// Lifecycle policy for pages captured by the installed widget (web_snapshot).
// Venue sites accumulate years of archive pages (tags, categories, pagination,
// search results) that only re-list other pages. Capturing them multiplies
// stale programme text in Knowledge, so they are never registered.

const ARCHIVE_PATH_SEGMENTS = new Set([
  'tag',
  'tags',
  'etiqueta',
  'etiquetas',
  'etiquetes',
  'category',
  'categories',
  'categoria',
  'categorias',
  'categoria-producto',
  'author',
  'autor',
  'autora',
  'search',
  'buscar',
  'cerca',
  'feed',
])

const ARCHIVE_QUERY_KEYS = new Set([
  's',
  'search',
  'q',
  'page',
  'paged',
  'cat',
  'tag',
  'author',
])

/** Maximum number of new installed pages a venue can register per rolling 24h. */
export const INSTALLED_WEB_NEW_PAGES_PER_DAY = 50

/** Marker written by operator cleanups on chunks retired from retrieval. */
export const RETIRED_CHUNK_METADATA_KEY = 'cleanup'

export function isArchiveListingUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }

  const segments = url.pathname
    .split('/')
    .map((segment) => safeDecode(segment).toLowerCase())
    .filter(Boolean)

  if (segments.some((segment) => ARCHIVE_PATH_SEGMENTS.has(segment))) return true

  // WordPress-style pagination: /page/2, /programacio/page/3
  for (let index = 0; index < segments.length - 1; index += 1) {
    if (segments[index] === 'page' && /^\d+$/.test(segments[index + 1])) return true
  }

  for (const key of url.searchParams.keys()) {
    if (ARCHIVE_QUERY_KEYS.has(key.toLowerCase())) return true
  }

  return false
}

/**
 * A page is retired when an operator deactivated its chunks (tagged with the
 * cleanup marker) and none remain active. A recapture must not silently
 * reactivate it.
 */
export function isRetiredInstalledPage({
  activeChunks,
  retiredChunks,
}: {
  activeChunks: number
  retiredChunks: number
}): boolean {
  return activeChunks === 0 && retiredChunks > 0
}

export function hasReachedDailyNewPageLimit(createdLast24h: number): boolean {
  return createdLast24h >= INSTALLED_WEB_NEW_PAGES_PER_DAY
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
