import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { buildContentSecurityPolicy } from '@/lib/security/content-security-policy'
import { applyPrivateNoStoreHeaders, isAuthenticationPath } from '@/lib/security/cache-control'

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const contentSecurityPolicy = buildContentSecurityPolicy({
    isDevelopment: process.env.NODE_ENV !== 'production',
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    splineSceneUrl: process.env.NEXT_PUBLIC_AUTH_SPLINE_SCENE_URL,
  })
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy)

  const response = await updateSession(request, requestHeaders)
  response.headers.set('Content-Security-Policy', contentSecurityPolicy)
  if (isAuthenticationPath(request.nextUrl.pathname)) {
    applyPrivateNoStoreHeaders(response.headers)
  }
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|olympia\\.html$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
