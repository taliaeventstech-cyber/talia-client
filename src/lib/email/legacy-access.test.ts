import { afterEach, describe, expect, it, vi } from 'vitest'
import { isLegacyEmailAgentAccount } from './legacy-access'

describe('legacy email agent access', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows only the TALIA legacy account by default', () => {
    vi.stubEnv('LEGACY_EMAIL_AGENT_ACCOUNT_EMAILS', '')

    expect(isLegacyEmailAgentAccount('talia.events.tech@gmail.com')).toBe(false)
    vi.unstubAllEnvs()
    expect(isLegacyEmailAgentAccount('talia.events.tech@gmail.com')).toBe(true)
    expect(isLegacyEmailAgentAccount('customer@example.com')).toBe(false)
  })

  it('normalizes configured email addresses', () => {
    vi.stubEnv('LEGACY_EMAIL_AGENT_ACCOUNT_EMAILS', ' Legacy@Example.com, second@example.com ')

    expect(isLegacyEmailAgentAccount('legacy@example.com')).toBe(true)
    expect(isLegacyEmailAgentAccount('SECOND@example.com')).toBe(true)
    expect(isLegacyEmailAgentAccount('customer@example.com')).toBe(false)
  })
})
