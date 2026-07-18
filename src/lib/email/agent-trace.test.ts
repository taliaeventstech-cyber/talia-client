import { describe, expect, it } from 'vitest'
import { getEmailAgentPhaseTrace, getEmailAgentProviderTrace } from './agent-trace'

describe('email agent trace', () => {
  it('records TALIA AI as the only effective provider', () => {
    expect(getEmailAgentProviderTrace()).toEqual({
      provider: 'talia-ai',
      requested_provider: 'talia-ai',
    })
  })

  it('keeps only compact operational metadata for each phase', () => {
    expect(getEmailAgentPhaseTrace({
      metadata: {
        agent: 'email_classifier',
        model: 'gpt-4o-mini',
        action: 'draft_requested',
        review_required: true,
        usage: { input_tokens: 120, output_tokens: 20 },
        body_text: 'must not be copied into the trace',
      },
    })).toEqual({
      provider: 'talia-ai',
      requested_provider: 'talia-ai',
      agent: 'email_classifier',
      model: 'gpt-4o-mini',
      action: 'draft_requested',
      review_required: true,
      input_tokens: 120,
      output_tokens: 20,
    })
  })
})
