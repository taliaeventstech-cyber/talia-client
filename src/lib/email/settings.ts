import type { Json } from '@/types/database.types'

export type EmailAgentTone = 'professional_cercano' | 'formal' | 'directo'
export type EmailAgentDraftStyle = 'breve' | 'detallado'

export type EmailAgentSettings = {
  tone: EmailAgentTone
  draftStyle: EmailAgentDraftStyle
  signature: string | null
  channelPrompt: string | null
  humanReviewTopics: string[]
  classificationRules: string | null
}

const defaultSettings: EmailAgentSettings = {
  tone: 'professional_cercano',
  draftStyle: 'breve',
  signature: null,
  channelPrompt: null,
  humanReviewTopics: ['devoluciones', 'quejas', 'grupos'],
  classificationRules: null,
}

export function getEmailAgentSettings(metadata: unknown): EmailAgentSettings {
  const record = getRecord(metadata)
  const settings = getRecord(record.email_agent_settings)

  return normalizeEmailAgentSettings({
    tone: typeof settings.tone === 'string' ? settings.tone : undefined,
    draftStyle: typeof settings.draft_style === 'string' ? settings.draft_style : undefined,
    signature: typeof settings.signature === 'string' ? settings.signature : undefined,
    channelPrompt: typeof settings.channel_prompt === 'string' ? settings.channel_prompt : undefined,
    humanReviewTopics: getStringList(settings.human_review_topics),
    classificationRules: typeof settings.classification_rules === 'string' ? settings.classification_rules : undefined,
  })
}

export function normalizeEmailAgentSettings(input: {
  tone?: string
  draftStyle?: string
  signature?: string | null
  channelPrompt?: string | null
  humanReviewTopics?: string[]
  classificationRules?: string | null
}): EmailAgentSettings {
  const tone: EmailAgentTone = input.tone === 'formal' || input.tone === 'directo'
    ? input.tone
    : defaultSettings.tone
  const draftStyle: EmailAgentDraftStyle = input.draftStyle === 'detallado'
    ? 'detallado'
    : defaultSettings.draftStyle

  return {
    tone,
    draftStyle,
    signature: cleanNullableText(input.signature, 500),
    channelPrompt: cleanNullableText(input.channelPrompt, 4000),
    humanReviewTopics: (input.humanReviewTopics?.length ? input.humanReviewTopics : defaultSettings.humanReviewTopics)
      .map((topic) => topic.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 25),
    classificationRules: cleanNullableText(input.classificationRules, 2000),
  }
}

export function emailAgentSettingsToMetadata(settings: EmailAgentSettings): Json {
  return {
    tone: settings.tone,
    draft_style: settings.draftStyle,
    signature: settings.signature,
    channel_prompt: settings.channelPrompt,
    human_review_topics: settings.humanReviewTopics,
    classification_rules: settings.classificationRules,
  }
}

function cleanNullableText(value: string | null | undefined, maxLength: number) {
  const cleaned = value?.trim()
  if (!cleaned) return null
  return cleaned.slice(0, maxLength)
}

function getRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function getStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}
