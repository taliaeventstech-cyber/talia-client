import type { NextRequest } from 'next/server'

export function getAuthCallbackUrl(request: NextRequest, path = '/auth/callback') {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  const origin = shouldUseRequestOrigin(request.nextUrl.origin, appUrl)
    ? request.nextUrl.origin
    : appUrl || request.nextUrl.origin

  return `${origin}${path}`
}

function shouldUseRequestOrigin(requestOrigin: string, appUrl?: string) {
  if (!appUrl) return true

  const requestHost = getHost(requestOrigin)
  const configuredHost = getHost(appUrl)
  if (!requestHost || !configuredHost) return true

  // Local auth flows must return to the exact local origin that initiated them.
  // A production APP_URL may still be present in shells, containers or previews.
  if (process.env.NODE_ENV !== 'production' && isLocalHost(requestHost)) return true

  if (isLocalHost(configuredHost) && !isLocalHost(requestHost)) return true

  return false
}

function getHost(value: string) {
  try {
    return new URL(value).host
  } catch {
    return ''
  }
}

function isLocalHost(host: string) {
  return host === 'localhost' ||
    host.startsWith('localhost:') ||
    host === '127.0.0.1' ||
    host.startsWith('127.0.0.1:') ||
    host === '[::1]' ||
    host.startsWith('[::1]:')
}
