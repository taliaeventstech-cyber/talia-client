import { describe, expect, it } from 'vitest'
import { isPublicBillingPlan } from './plans'

describe('public billing plans', () => {
  it('only exposes the web AI assistant during the launch phase', () => {
    expect(isPublicBillingPlan('chatbot_web')).toBe(true)
    expect(isPublicBillingPlan('chatbot_email')).toBe(false)
    expect(isPublicBillingPlan('email_agent')).toBe(false)
  })
})
