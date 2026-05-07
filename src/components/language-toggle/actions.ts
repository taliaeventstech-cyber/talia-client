'use server'

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from '@/lib/i18n/config'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

export async function setLocaleAction(localeOrFormData: FormData | string) {
  const requestedLocale = typeof localeOrFormData === 'string'
    ? localeOrFormData
    : String(localeOrFormData.get('locale') ?? '')
  const locale = isLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath('/', 'layout')
}
