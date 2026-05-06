import type { NextRequest } from 'next/server'

export function getAuthCallbackUrl(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') {
    return `${request.nextUrl.origin}/auth/callback`
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  const origin = appUrl || request.nextUrl.origin

  return `${origin}/auth/callback`
}
