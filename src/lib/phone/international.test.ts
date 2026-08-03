import { describe, expect, it } from 'vitest'
import {
  buildInternationalPhoneValue,
  getDefaultPhoneCountry,
  normalizeInternationalPhoneValue,
  splitInternationalPhoneValue,
} from './international'
import { optionalInternationalPhoneSchema } from './schema'

describe('international phone helpers', () => {
  it('builds a canonical E.164 value from country and national number', () => {
    expect(buildInternationalPhoneValue('ES', '600 123 456')).toBe('+34600123456')
    expect(buildInternationalPhoneValue('GB', '020 7946 0018')).toBe('+442079460018')
  })

  it('splits an existing E.164 value for editing', () => {
    expect(splitInternationalPhoneValue('+34600123456', 'GB')).toEqual({
      country: 'ES',
      nationalNumber: '600123456',
    })
  })

  it('preserves an unparseable legacy value in the national field', () => {
    expect(splitInternationalPhoneValue('legacy extension 42', 'ES')).toEqual({
      country: 'ES',
      nationalNumber: 'legacy extension 42',
    })
  })

  it('rejects invalid values and accepts an empty optional phone', () => {
    expect(normalizeInternationalPhoneValue('+34 600 123 456')).toBe('+34600123456')
    expect(normalizeInternationalPhoneValue('600')).toBeNull()
    expect(optionalInternationalPhoneSchema.safeParse('600').success).toBe(false)
    expect(optionalInternationalPhoneSchema.parse('')).toBe('')
  })

  it('uses Brazil as the default country for Brazilian Portuguese', () => {
    expect(getDefaultPhoneCountry('pt-BR')).toBe('BR')
  })
})
