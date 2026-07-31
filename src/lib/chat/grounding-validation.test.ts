import { describe, expect, it } from 'vitest'
import { summarizeGroundingValidation } from './grounding-validation'

describe('summarizeGroundingValidation', () => {
  it('keeps bounded grounding diagnostics for response-trace exports', () => {
    expect(summarizeGroundingValidation({
      status: 'rejected',
      declared_source_ids: ['official-address'],
      invalid_source_ids: [],
      unsupported_critical_facts: ['Carrer de la Riereta, 31, 08001 Barcelona'],
    })).toEqual({
      status: 'rejected',
      declared_source_ids: ['official-address'],
      invalid_source_ids: [],
      unsupported_critical_facts: ['Carrer de la Riereta, 31, 08001 Barcelona'],
    })
  })

  it('rejects malformed diagnostic metadata', () => {
    expect(summarizeGroundingValidation({ status: 'unknown' })).toBeNull()
    expect(summarizeGroundingValidation(null)).toBeNull()
  })
})
