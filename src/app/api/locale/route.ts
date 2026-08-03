import { isLocale, LOCALE_COOKIE } from '@/lib/i18n/config'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_locale' }, { status: 400 })
  }

  const locale = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).locale
    : null

  if (typeof locale !== 'string' || !isLocale(locale)) {
    return NextResponse.json({ error: 'invalid_locale' }, { status: 400 })
  }

  const response = new NextResponse(null, { status: 204 })
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
