import { describe, expect, it } from 'vitest'
import {
  getChatbotOnboardingSourceUrlIssue,
  normalizeChatbotOnboardingSourceUrl,
} from './chatbot-onboarding-source'

describe('chatbot onboarding source URL', () => {
  it('normalizes a bare official website domain', () => {
    expect(normalizeChatbotOnboardingSourceUrl(' www.example.org/programacion '))
      .toBe('https://www.example.org/programacion')
  })

  it('keeps an explicit HTTP(S) URL unchanged', () => {
    expect(normalizeChatbotOnboardingSourceUrl('http://example.org'))
      .toBe('http://example.org')
  })

  it('accepts an empty optional source', () => {
    expect(getChatbotOnboardingSourceUrlIssue('')).toBeNull()
  })

  it.each([
    ['ftp://example.org', 'protocol'],
    ['https://localhost', 'domain'],
    ['https://', 'invalid'],
  ] as const)('classifies %s as %s', (value, expected) => {
    expect(getChatbotOnboardingSourceUrlIssue(value)).toBe(expected)
  })
})
