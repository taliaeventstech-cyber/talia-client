import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasExplicitTaliaAiCanaryConnection, isLegacyEmailAgentAccount } from './legacy-access'

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

describe('explicit TALIA AI canary access', () => {
  it('allows a tenant with an explicit TALIA AI connection override', () => {
    expect(hasExplicitTaliaAiCanaryConnection([
      { metadata: { email_agent_provider: 'inherit' } },
      { metadata: { email_agent_provider: 'talia-ai' } },
    ])).toBe(true)
  })

  it('does not expose email for inherited or legacy n8n connections', () => {
    expect(hasExplicitTaliaAiCanaryConnection([
      { metadata: { email_agent_provider: 'inherit' } },
      { metadata: { email_agent_provider: 'n8n' } },
    ])).toBe(false)
  })
})
