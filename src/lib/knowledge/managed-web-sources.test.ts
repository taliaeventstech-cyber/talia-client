import { describe, expect, it } from 'vitest'
import {
  getNextKnowledgeSyncAt,
  validateManagedWebSourceInput,
} from './managed-web-sources'

const baseInput = {
  name: 'Web oficial',
  sourceType: 'website',
  sourceUrl: 'https://www.example.org/programacion?utm_source=campaign',
  refreshInterval: 'daily',
  authorizedHosts: ['example.org', 'www.example.org'],
}

describe('validateManagedWebSourceInput', () => {
  it('normalizes an authorized public source and removes tracking parameters', () => {
    expect(validateManagedWebSourceInput(baseInput)).toEqual({
      ok: true,
      data: {
        name: 'Web oficial',
        sourceType: 'website',
        sourceUrl: 'https://example.org/programacion',
        originalUrl: baseInput.sourceUrl,
        refreshInterval: 'daily',
      },
    })
  })

  it('rejects domains that are not authorized for the tenant', () => {
    expect(validateManagedWebSourceInput({
      ...baseInput,
      sourceUrl: 'https://attacker.example/page',
    })).toEqual({
      ok: false,
      error: 'La URL debe pertenecer a un dominio autorizado del espacio.',
    })
  })

  it.each([
    'http://127.0.0.1/admin',
    'http://10.0.0.5/internal',
    'http://[::1]/internal',
  ])('rejects private target %s', (sourceUrl) => {
    const hostname = new URL(sourceUrl).hostname.replace(/^\[|\]$/g, '')
    expect(validateManagedWebSourceInput({
      ...baseInput,
      sourceUrl,
      authorizedHosts: [hostname],
    }).ok).toBe(false)
  })

  it('rejects URLs with embedded credentials', () => {
    expect(validateManagedWebSourceInput({
      ...baseInput,
      sourceUrl: 'https://user:password@example.org/private',
    }).ok).toBe(false)
  })
})

describe('getNextKnowledgeSyncAt', () => {
  const from = new Date('2026-07-14T12:00:00.000Z')

  it('keeps manual sources unscheduled', () => {
    expect(getNextKnowledgeSyncAt('manual', from)).toBeNull()
  })

  it.each([
    ['daily', '2026-07-15T12:00:00.000Z'],
    ['weekly', '2026-07-21T12:00:00.000Z'],
    ['monthly', '2026-08-14T12:00:00.000Z'],
  ] as const)('calculates the next %s run', (interval, expected) => {
    expect(getNextKnowledgeSyncAt(interval, from)?.toISOString()).toBe(expected)
  })
})
