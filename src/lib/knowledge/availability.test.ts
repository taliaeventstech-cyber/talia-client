import { describe, expect, it } from 'vitest'
import { shouldBlockChatbotActivation } from './availability'

describe('chatbot knowledge availability', () => {
  it('blocks activating an inactive chatbot without usable knowledge', () => {
    expect(shouldBlockChatbotActivation({
      currentlyEnabled: false,
      requestedEnabled: true,
      hasUsableKnowledge: false,
    })).toBe(true)
  })

  it('allows activation when usable knowledge is ready', () => {
    expect(shouldBlockChatbotActivation({
      currentlyEnabled: false,
      requestedEnabled: true,
      hasUsableKnowledge: true,
    })).toBe(false)
  })

  it('allows an existing active chatbot to save settings without a retroactive shutdown', () => {
    expect(shouldBlockChatbotActivation({
      currentlyEnabled: true,
      requestedEnabled: true,
      hasUsableKnowledge: false,
    })).toBe(false)
  })

  it('always allows disabling the chatbot', () => {
    expect(shouldBlockChatbotActivation({
      currentlyEnabled: true,
      requestedEnabled: false,
      hasUsableKnowledge: false,
    })).toBe(false)
  })
})
