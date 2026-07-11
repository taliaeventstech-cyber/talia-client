'use client'

import { useMemo, useState } from 'react'
import type { CountryCode } from 'libphonenumber-js'
import {
  buildInternationalPhoneValue,
  getPhoneCountryOptions,
  splitInternationalPhoneValue,
} from '@/lib/phone/international'

type InternationalPhoneInputProps = {
  name: string
  label: string
  defaultValue?: string | null
  defaultCountry?: CountryCode
  locale?: string
  countryLabel?: string
  numberLabel?: string
  numberPlaceholder?: string
  optionalHint?: string
  onValueChange?: (value: string) => void
}

export function InternationalPhoneInput({
  name,
  label,
  defaultValue,
  defaultCountry = 'ES',
  locale = 'es',
  countryLabel,
  numberLabel,
  numberPlaceholder = '600 123 456',
  optionalHint,
  onValueChange,
}: InternationalPhoneInputProps) {
  const initialParts = useMemo(
    () => splitInternationalPhoneValue(defaultValue, defaultCountry),
    [defaultCountry, defaultValue],
  )
  const [country, setCountry] = useState<CountryCode>(initialParts.country)
  const [nationalNumber, setNationalNumber] = useState(initialParts.nationalNumber)
  const countries = useMemo(() => getPhoneCountryOptions(locale), [locale])
  const copy = getPhoneInputCopy(locale)
  const normalizedValue = buildInternationalPhoneValue(country, nationalNumber)
  const submittedValue = normalizedValue ?? nationalNumber.trim()
  const invalid = Boolean(nationalNumber.trim()) && normalizedValue === null

  function updateCountry(nextCountry: CountryCode) {
    setCountry(nextCountry)
    onValueChange?.(buildInternationalPhoneValue(nextCountry, nationalNumber) ?? nationalNumber.trim())
  }

  function updateNationalNumber(nextNationalNumber: string) {
    setNationalNumber(nextNationalNumber)
    onValueChange?.(buildInternationalPhoneValue(country, nextNationalNumber) ?? nextNationalNumber.trim())
  }

  return (
    <div className="field international-phone-field">
      <span>{label}</span>
      <div className="international-phone-controls">
        <label>
          <span className="sr-only">{countryLabel ?? copy.countryLabel}</span>
          <select
            aria-label={countryLabel ?? copy.countryLabel}
            value={country}
            onChange={(event) => updateCountry(event.target.value as CountryCode)}
          >
            {countries.map((option) => (
              <option key={option.country} value={option.country}>
                {option.label} (+{option.callingCode})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">{numberLabel ?? copy.numberLabel}</span>
          <input
            aria-invalid={invalid}
            aria-label={numberLabel ?? copy.numberLabel}
            autoComplete="tel-national"
            inputMode="tel"
            placeholder={numberPlaceholder}
            type="tel"
            value={nationalNumber}
            onChange={(event) => updateNationalNumber(event.target.value)}
          />
        </label>
      </div>
      <input name={name} type="hidden" value={submittedValue} />
      {invalid ? (
        <span className="field-error">{copy.invalid}</span>
      ) : optionalHint ? (
        <span className="field-hint">{optionalHint}</span>
      ) : null}
    </div>
  )
}

function getPhoneInputCopy(locale: string) {
  if (locale.toLowerCase().startsWith('ca')) {
    return {
      countryLabel: 'País i prefix',
      numberLabel: 'Número de telèfon',
      invalid: 'Introdueix un número vàlid per al país seleccionat.',
    }
  }
  if (locale.toLowerCase().startsWith('en')) {
    return {
      countryLabel: 'Country and calling code',
      numberLabel: 'Phone number',
      invalid: 'Enter a valid number for the selected country.',
    }
  }
  return {
    countryLabel: 'País y prefijo',
    numberLabel: 'Número de teléfono',
    invalid: 'Introduce un número válido para el país seleccionado.',
  }
}
