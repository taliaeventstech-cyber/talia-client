import { describe, expect, it } from 'vitest'
import { formatDateTime } from './date-time'

describe('formatDateTime', () => {
  it('formats the same instant in the requested IANA time zone', () => {
    const value = '2026-08-02T01:30:00.000Z'

    expect(formatDateTime(value, 'es-ES', 'UTC')).toContain('01:30')
    expect(formatDateTime(value, 'pt-BR', 'America/Sao_Paulo')).toContain('22:30')
  })

  it('distinguishes the two repeated Madrid times during the DST rollback', () => {
    const first = formatDateTime('2026-10-25T00:30:00.000Z', 'es-ES', 'Europe/Madrid')
    const second = formatDateTime('2026-10-25T01:30:00.000Z', 'es-ES', 'Europe/Madrid')

    expect(first).not.toBe(second)
  })
})
