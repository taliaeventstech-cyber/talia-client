import type { NextRequest } from 'next/server'

export function getAuthCallbackUrl(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  const origin = shouldUseRequestOrigin(request.nextUrl.origin, appUrl)
    ? request.nextUrl.origin
    : appUrl || request.nextUrl.origin

  return `${origin}/auth/callback`
}

function shouldUseRequestOrigin(requestOrigin: string, appUrl?: string) {
  if (!appUrl) return true

  const requestHost = getHost(requestOrigin)
  const configuredHost = getHost(appUrl)
  if (!requestHost || !configuredHost) return true

  if (isLocalHost(configuredHost) && !isLocalHost(requestHost)) return true

  return isLocalHost(requestHost) && isLocalHost(configuredHost) && requestHost !== configuredHost
}

function getHost(value: string) {
  try {
    return new URL(value).host
  } catch {
    return ''
  }
}

function isLocalHost(host: string) {
  return host.startsWith('localhost:') || host.startsWith('127.0.0.1:')
}
