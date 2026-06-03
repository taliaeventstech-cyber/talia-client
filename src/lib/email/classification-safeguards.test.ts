// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { applyEmailClassificationSafeguards } from './classification-safeguards'

describe('email classification safeguards', () => {
  it('keeps partnership proposals actionable even when the agent marks them as other', () => {
    const classification = applyEmailClassificationSafeguards({
      subject: 'Re: Proposta de partnership',
      bodyText: 'Hola, ens agradaria parlar duna possible collaboracio comercial amb el teatre.',
      rulesClassification: {
        shouldProcess: true,
        reason: 'candidate_for_agent',
        source: 'rules',
        confidence: 0.7,
      },
      agentClassification: {
        shouldProcess: true,
        shouldGenerateDraft: false,
        needsHumanReview: false,
        topic: 'otro',
        priority: 'low',
        confidence: 0.62,
        classificationReason: 'other',
        escalationReason: null,
      },
    })

    expect(classification.shouldProcess).toBe(true)
    expect(classification.shouldGenerateDraft).toBe(true)
    expect(classification.needsHumanReview).toBe(true)
    expect(classification.priority).toBe('normal')
    expect(classification.classificationReason).toBe('partnership_request')
    expect(classification.escalationReason).toBe('partnership_request')
  })

  it('does not override blocked local rule classifications', () => {
    const classification = applyEmailClassificationSafeguards({
      subject: 'Partnership',
      bodyText: 'Collaboration proposal',
      rulesClassification: {
        shouldProcess: false,
        reason: 'blocked_sender',
        source: 'rules',
        confidence: 1,
      },
      agentClassification: {
        shouldProcess: false,
        shouldGenerateDraft: false,
        needsHumanReview: false,
        topic: 'otro',
        priority: 'normal',
        confidence: 0.9,
        classificationReason: 'spam',
        escalationReason: null,
      },
    })

    expect(classification.shouldProcess).toBe(false)
    expect(classification.shouldGenerateDraft).toBe(false)
    expect(classification.needsHumanReview).toBe(false)
  })
})
