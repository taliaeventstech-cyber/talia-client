export type ChatbotGroundingMode = 'strict' | 'balanced'

export type ChatbotAiSettings = {
  temperature: number
  groundingMode: ChatbotGroundingMode
  minContextScore: number
  maxContextItems: number
  fallbackContacts: boolean
}

export const defaultChatbotAiSettings: ChatbotAiSettings = {
  temperature: 0.2,
  groundingMode: 'strict',
  minContextScore: 0.3,
  maxContextItems: 5,
  fallbackContacts: true,
}

export function normalizeChatbotAiSettings(value: unknown): ChatbotAiSettings {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

  return {
    temperature: clampNumber(record.temperature, 0, 1, defaultChatbotAiSettings.temperature),
    groundingMode: record.groundingMode === 'balanced' || record.grounding_mode === 'balanced'
      ? 'balanced'
      : 'strict',
    minContextScore: clampNumber(
      record.minContextScore ?? record.min_context_score,
      0,
      1,
      defaultChatbotAiSettings.minContextScore,
    ),
    maxContextItems: clampInteger(
      record.maxContextItems ?? record.max_context_items,
      1,
      10,
      defaultChatbotAiSettings.maxContextItems,
    ),
    fallbackContacts: typeof record.fallbackContacts === 'boolean'
      ? record.fallbackContacts
      : typeof record.fallback_contacts === 'boolean'
        ? record.fallback_contacts
        : defaultChatbotAiSettings.fallbackContacts,
  }
}

export function chatbotAiSettingsToWidgetConfig(settings: ChatbotAiSettings) {
  return {
    temperature: settings.temperature,
    groundingMode: settings.groundingMode,
    minContextScore: settings.minContextScore,
    maxContextItems: settings.maxContextItems,
    fallbackContacts: settings.fallbackContacts,
  }
}

export function chatbotAiSettingsToRuntime(settings: ChatbotAiSettings) {
  return {
    temperature: settings.temperature,
    grounding_mode: settings.groundingMode,
    min_context_score: settings.minContextScore,
    max_context_items: settings.maxContextItems,
    fallback_contacts: settings.fallbackContacts,
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const number = Math.round(clampNumber(value, min, max, fallback))
  return Math.min(max, Math.max(min, number))
}
