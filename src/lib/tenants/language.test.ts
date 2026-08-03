import { describe, expect, it } from 'vitest'
import { isTenantLanguage, TENANT_LANGUAGES } from './language'

describe('tenant languages', () => {
  it('supports Brazilian Portuguese throughout tenant provisioning', () => {
    expect(TENANT_LANGUAGES).toContain('pt-BR')
    expect(isTenantLanguage('pt-BR')).toBe(true)
    expect(isTenantLanguage('pt_BR')).toBe(false)
  })
})
