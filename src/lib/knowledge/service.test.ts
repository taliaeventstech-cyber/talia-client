// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { shouldAnswerFromKnowledge, type KnowledgeMatch } from './service'

describe('shouldAnswerFromKnowledge', () => {
  it('requires a strong enough match before bypassing the agent', () => {
    expect(shouldAnswerFromKnowledge([{ score: 10 } as KnowledgeMatch])).toBe(true)
    expect(shouldAnswerFromKnowledge([{ score: 4 } as KnowledgeMatch])).toBe(false)
    expect(shouldAnswerFromKnowledge([])).toBe(false)
  })
})
