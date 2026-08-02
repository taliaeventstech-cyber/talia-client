export const LOCALES = ['es', 'ca', 'en', 'pt-BR'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'es'
export const LOCALE_COOKIE = 'talia-locale'

export function isLocale(value: string | undefined | null): value is Locale {
  return LOCALES.includes(value as Locale)
}

export function getIntlLocale(locale: Locale) {
  if (locale === 'ca') return 'ca-ES'
  if (locale === 'en') return 'en-GB'
  if (locale === 'pt-BR') return 'pt-BR'
  return 'es-ES'
}
