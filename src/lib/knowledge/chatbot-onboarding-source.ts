export type ChatbotOnboardingSourceUrlIssue = 'protocol' | 'domain' | 'invalid'

export function normalizeChatbotOnboardingSourceUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function getChatbotOnboardingSourceUrlIssue(
  value: string,
): ChatbotOnboardingSourceUrlIssue | null {
  const normalized = normalizeChatbotOnboardingSourceUrl(value)
  if (!normalized) return null

  try {
    const parsed = new URL(normalized)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return 'protocol'
    if (!parsed.hostname.includes('.')) return 'domain'
    return null
  } catch {
    return 'invalid'
  }
}
