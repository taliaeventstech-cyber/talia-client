export const LOCALES = ['es', 'ca', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'es'
export const LOCALE_COOKIE = 'talia-locale'

export function isLocale(value: string | undefined | null): value is Locale {
  return LOCALES.includes(value as Locale)
}
