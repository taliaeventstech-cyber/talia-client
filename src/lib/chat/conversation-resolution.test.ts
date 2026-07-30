import { describe, expect, it } from 'vitest'
import {
  extractPreviousConversationResolution,
  parseConversationResolution,
} from './conversation-resolution'

describe('conversation resolution state', () => {
  it('recovers the latest bounded resolution from persisted assistant metadata', () => {
    expect(extractPreviousConversationResolution({
      source: 'talia-ai',
      agent_metadata: {
        action: 'clarification_requested',
        resolution: {
          version: 1,
          state: 'needs_clarification',
          clarification_attempts: 1,
          topic: 'horarios',
          intent: 'planning',
          transition: 'clarification_requested',
        },
      },
    })).toEqual({
      version: 1,
      state: 'needs_clarification',
      clarificationAttempts: 1,
      topic: 'horarios',
      intent: 'planning',
    })
  })

  it('ignores malformed or future resolution contracts', () => {
    expect(parseConversationResolution({
      version: 2,
      state: 'thinking',
      clarification_attempts: 99,
    })).toBeUndefined()
  })
})
