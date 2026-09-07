import { describe, expect, it } from 'vitest'
import { summarizeGroundingValidation } from './grounding-validation'

describe('summarizeGroundingValidation', () => {
  it('keeps bounded grounding diagnostics for response-trace exports', () => {
    expect(summarizeGroundingValidation({
      status: 'rejected',
      review: {
        status: 'rejected',
        reason: 'unsupported_claims',
        reviewed_count: 1,
      },
      declared_source_ids: ['official-address'],
      invalid_source_ids: [],
      lexical_mismatches: [],
      semantic_review_facts: ['"L’estanquera del Raval" es una obra que se presenta en **castellano**.'],
      unsupported_critical_facts: ['Carrer de la Riereta, 31, 08001 Barcelona'],
    })).toEqual({
      status: 'rejected',
      review: {
        status: 'rejected',
        reason: 'unsupported_claims',
        reviewed_count: 1,
      },
      declared_source_ids: ['official-address'],
      invalid_source_ids: [],
      lexical_mismatches: [],
      semantic_review_facts: ['"L’estanquera del Raval" es una obra que se presenta en **castellano**.'],
      unsupported_critical_facts: ['Carrer de la Riereta, 31, 08001 Barcelona'],
    })
  })

  it('rejects malformed diagnostic metadata', () => {
    expect(summarizeGroundingValidation({ status: 'unknown' })).toBeNull()
    expect(summarizeGroundingValidation(null)).toBeNull()
  })
})
