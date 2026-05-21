import type { Json } from '@/types/database.types'

export type EmailAgentTone = 'professional_cercano' | 'formal' | 'directo'
export type EmailAgentDraftStyle = 'breve' | 'detallado'

export type EmailAgentSettings = {
  tone: EmailAgentTone
  draftStyle: EmailAgentDraftStyle
  signature: string | null
  channelPrompt: string | null
  classificationTopics: string[]
  humanReviewTopics: string[]
  classificationRules: string | null
}

export const defaultEmailClassificationTopics = [
  'entradas',
  'horarios',
  'ubicacion',
  'accesibilidad',
  'programacion',
  'grupos',
  'devoluciones',
  'partnerships',
  'prensa',
  'quejas',
  'facturacion',
  'otro',
] as const

const defaultSettings: EmailAgentSettings = {
  tone: 'professional_cercano',
  draftStyle: 'breve',
  signature: null,
  channelPrompt: null,
  classificationTopics: [...defaultEmailClassificationTopics],
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
    classificationTopics: getStringList(settings.classification_topics),
    humanReviewTopics: getStringList(settings.human_review_topics),
    classificationRules: typeof settings.classification_rules === 'string' ? settings.classification_rules : undefined,
  })
}

export function normalizeEmailAgentSettings(input: {
  tone?: string
  draftStyle?: string
  signature?: string | null
  channelPrompt?: string | null
  classificationTopics?: string[]
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
    classificationTopics: normalizeTopicList(input.classificationTopics, defaultSettings.classificationTopics, 40, true),
    humanReviewTopics: normalizeTopicList(input.humanReviewTopics, defaultSettings.humanReviewTopics, 25),
    classificationRules: cleanNullableText(input.classificationRules, 2000),
  }
}

export function emailAgentSettingsToMetadata(settings: EmailAgentSettings): Json {
  return {
    tone: settings.tone,
    draft_style: settings.draftStyle,
    signature: settings.signature,
    channel_prompt: settings.channelPrompt,
    classification_topics: settings.classificationTopics,
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

function normalizeTopicList(
  values: string[] | undefined,
  fallback: string[],
  maxItems: number,
  includeOther = false,
) {
  const candidates = values?.length ? values : fallback
  const normalized = candidates
    .map(normalizeTopic)
    .filter(Boolean)
  const unique = Array.from(new Set(normalized)).slice(0, maxItems)

  if (!unique.length) return fallback
  if (includeOther && !unique.includes('otro')) return [...unique, 'otro'].slice(0, maxItems)
  return unique
}

function normalizeTopic(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}
