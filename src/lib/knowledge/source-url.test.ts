import { describe, expect, it } from 'vitest'
import { normalizeKnowledgeSourceUrl } from './source-url'

describe('normalizeKnowledgeSourceUrl', () => {
  it('removes tracking parameters without losing functional query parameters', () => {
    expect(normalizeKnowledgeSourceUrl(
      'https://WWW.Example.com/events/?event=42&utm_source=instagram&fbclid=abc#tickets'
    )).toBe('https://example.com/events?event=42')
  })

  it('sorts functional parameters into a stable identity', () => {
    expect(normalizeKnowledgeSourceUrl('https://example.com/program?z=2&a=1')).toBe(
      'https://example.com/program?a=1&z=2'
    )
  })

  it('rejects non-web protocols', () => {
    expect(normalizeKnowledgeSourceUrl('ftp://example.com/file')).toBeNull()
  })
})
