import { describe, expect, it } from 'vitest'
import { getDefaultProactiveGreeting, normalizeProactiveGreeting } from './proactive-greeting'

describe('proactive greeting', () => {
  it('provides localized defaults', () => {
    expect(getDefaultProactiveGreeting('es')).toBe('Soy TALIA. ¿Te ayudo?')
    expect(getDefaultProactiveGreeting('ca')).toBe("Soc TALIA. T'ajudo?")
    expect(getDefaultProactiveGreeting('en')).toBe("I'm TALIA. Can I help?")
  })

  it('keeps a tenant-defined greeting', () => {
    expect(normalizeProactiveGreeting('  ¿Necesitas ayuda?  ', 'es')).toBe('¿Necesitas ayuda?')
  })

  it('falls back when the configured greeting is empty', () => {
    expect(normalizeProactiveGreeting('', 'en', 'Mia')).toBe("I'm Mia. Can I help?")
  })
})
