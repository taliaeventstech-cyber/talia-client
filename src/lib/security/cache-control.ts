export const PRIVATE_NO_STORE_HEADERS = [
  { key: 'Cache-Control', value: 'no-store, max-age=0' },
  { key: 'Pragma', value: 'no-cache' },
  { key: 'Expires', value: '0' },
] as const

export function applyPrivateNoStoreHeaders(headers: Headers) {
  for (const { key, value } of PRIVATE_NO_STORE_HEADERS) {
    headers.set(key, value)
  }
}

export function isAuthenticationPath(pathname: string) {
  return pathname === '/auth' || pathname.startsWith('/auth/')
}
