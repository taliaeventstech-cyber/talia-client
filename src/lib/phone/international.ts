import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js'

export type InternationalPhoneParts = {
  country: CountryCode
  nationalNumber: string
}

export function normalizeInternationalPhoneValue(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return ''

  const phone = parsePhoneNumberFromString(trimmed)
  return phone?.isValid() ? phone.number : null
}

export function buildInternationalPhoneValue(country: CountryCode, nationalNumber: string) {
  const trimmed = nationalNumber.trim()
  if (!trimmed) return ''

  const phone = parsePhoneNumberFromString(trimmed, country)
  return phone?.isValid() ? phone.number : null
}

export function splitInternationalPhoneValue(
  value: string | null | undefined,
  fallbackCountry: CountryCode = 'ES',
): InternationalPhoneParts {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return { country: fallbackCountry, nationalNumber: '' }

  const phone = parsePhoneNumberFromString(trimmed)
  if (!phone?.country) return { country: fallbackCountry, nationalNumber: trimmed }

  return {
    country: phone.country,
    nationalNumber: phone.nationalNumber,
  }
}

export function getDefaultPhoneCountry(language: string): CountryCode {
  return language.toLowerCase().startsWith('en') ? 'GB' : 'ES'
}

export function getPhoneCountryOptions(locale: string) {
  const displayNames = new Intl.DisplayNames([locale], { type: 'region' })
  return getCountries()
    .map((country) => ({
      country,
      callingCode: getCountryCallingCode(country),
      label: displayNames.of(country) ?? country,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, locale))
}
