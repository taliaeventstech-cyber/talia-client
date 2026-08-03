import { describe, expect, it } from 'vitest'
import { shouldAutoEnableManagedWebSource } from './managed-web-activation'

describe('managed web source activation', () => {
  it('auto-enables a source created during the initial chatbot onboarding', () => {
    expect(shouldAutoEnableManagedWebSource({
      creationMode: 'onboarding',
      chatbotSetupCompleted: false,
    })).toBe(true)
  })

  it('keeps ordinary source creation behind the Backstage rollout control', () => {
    expect(shouldAutoEnableManagedWebSource({
      creationMode: 'supervised',
      chatbotSetupCompleted: false,
    })).toBe(false)
  })

  it('does not let a completed setup reuse onboarding activation', () => {
    expect(shouldAutoEnableManagedWebSource({
      creationMode: 'onboarding',
      chatbotSetupCompleted: true,
    })).toBe(false)
  })
})
