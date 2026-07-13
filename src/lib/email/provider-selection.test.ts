import { describe, expect, it } from 'vitest'
import { getEmailAgentPhaseTrace, getEmailAgentProviderOverride, getEmailAgentProviderTrace, resolveEmailAgentProvider } from './provider-selection'

describe('email provider selection', () => {
  it('inherits n8n when no valid environment default exists', () => {
    expect(resolveEmailAgentProvider({}, undefined)).toEqual({
      override: 'inherit',
      requestedProvider: 'n8n',
    })
  })

  it('inherits talia-ai from the environment', () => {
    expect(resolveEmailAgentProvider({}, 'talia-ai')).toEqual({
      override: 'inherit',
      requestedProvider: 'talia-ai',
    })
  })

  it('lets a connection override the global provider', () => {
    expect(resolveEmailAgentProvider({ email_agent_provider: 'talia-ai' }, 'n8n')).toEqual({
      override: 'talia-ai',
      requestedProvider: 'talia-ai',
    })
    expect(resolveEmailAgentProvider({ email_agent_provider: 'n8n' }, 'talia-ai')).toEqual({
      override: 'n8n',
      requestedProvider: 'n8n',
    })
  })

  it('ignores unknown metadata values', () => {
    expect(getEmailAgentProviderOverride({ email_agent_provider: 'other' })).toBe('inherit')
  })

  it('traces requested, actual and fallback providers independently', () => {
    const selection = { override: 'talia-ai' as const, requestedProvider: 'talia-ai' as const }

    expect(getEmailAgentProviderTrace({ provider: 'talia-ai' }, selection)).toEqual({
      provider: 'talia-ai',
      requested_provider: 'talia-ai',
      provider_override: 'talia-ai',
      fallback_used: false,
    })
    expect(getEmailAgentProviderTrace({ provider: 'n8n', fallback_from: 'talia-ai' }, selection)).toEqual({
      provider: 'n8n',
      requested_provider: 'talia-ai',
      provider_override: 'talia-ai',
      fallback_used: true,
    })
  })

  it('keeps only compact operational metadata for each canary phase', () => {
    const selection = { override: 'talia-ai' as const, requestedProvider: 'talia-ai' as const }

    expect(getEmailAgentPhaseTrace({
      provider: 'talia-ai',
      metadata: {
        agent: 'email_classifier',
        model: 'gpt-4o-mini',
        action: 'draft_requested',
        review_required: true,
        usage: { input_tokens: 120, output_tokens: 20 },
        body_text: 'must not be copied into the trace',
      },
    }, selection)).toEqual({
      provider: 'talia-ai',
      requested_provider: 'talia-ai',
      provider_override: 'talia-ai',
      fallback_used: false,
      agent: 'email_classifier',
      model: 'gpt-4o-mini',
      action: 'draft_requested',
      review_required: true,
      input_tokens: 120,
      output_tokens: 20,
    })
  })
})
