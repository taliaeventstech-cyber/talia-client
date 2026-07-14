import { describe, expect, it } from 'vitest'
import { isChatbotEnabled } from './availability'

describe('isChatbotEnabled', () => {
  it('keeps existing tenants active when the setting is absent', () => {
    expect(isChatbotEnabled(undefined)).toBe(true)
    expect(isChatbotEnabled(null)).toBe(true)
  })

  it('only disables the chatbot for an explicit false value', () => {
    expect(isChatbotEnabled(false)).toBe(false)
    expect(isChatbotEnabled(true)).toBe(true)
  })
})
