const MAX_PROACTIVE_GREETING_LENGTH = 160

export function getDefaultProactiveGreeting(language: unknown, assistantName = 'TALIA') {
  const name = assistantName.trim() || 'TALIA'

  if (language === 'ca') return `Soc ${name}. T'ajudo?`
  if (language === 'en') return `I'm ${name}. Can I help?`
  return `Soy ${name}. ¿Te ayudo?`
}

export function normalizeProactiveGreeting(
  value: unknown,
  language: unknown,
  assistantName = 'TALIA'
) {
  if (typeof value !== 'string' || !value.trim()) {
    return getDefaultProactiveGreeting(language, assistantName)
  }

  return value.trim().slice(0, MAX_PROACTIVE_GREETING_LENGTH)
}
