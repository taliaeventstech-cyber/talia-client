import type { NextRequest } from 'next/server'

export function getAuthCallbackUrl(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '')
  const origin = appUrl || request.nextUrl.origin

  return `${origin}/auth/callback`
}
