export const WIDGET_LANGUAGES = ['es', 'ca', 'en', 'pt-BR'] as const
export const SUGGESTED_QUESTION_TARGET_TYPES = ['hostname', 'path_prefix', 'exact_url'] as const
export const MAX_SUGGESTED_QUESTIONS = 24
export const MAX_VISIBLE_SUGGESTED_QUESTIONS = 6
export const MAX_SUGGESTED_QUESTION_TARGETS = 5
export const MAX_SUGGESTED_QUESTION_LENGTH = 160
export const MAX_SUGGESTED_QUESTION_TARGET_LENGTH = 2_048

export type WidgetLanguage = (typeof WIDGET_LANGUAGES)[number]
export type SuggestedQuestionTargetType = (typeof SUGGESTED_QUESTION_TARGET_TYPES)[number]

export type SuggestedQuestionTarget = {
  id: string
  type: SuggestedQuestionTargetType
  value: string
}

export type SuggestedQuestion = {
  id: string
  enabled: boolean
  text: string
  targets: SuggestedQuestionTarget[]
}

export type VisibleSuggestedQuestion = {
  id: string
  text: string
  position: number
  language: WidgetLanguage
  source: 'contextual' | 'general'
  matchedTarget: SuggestedQuestionTarget | null
}

export type SuggestedQuestionSelectionInput = {
  id?: unknown
  position?: unknown
  language?: unknown
}

const SUGGESTED_QUESTION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{7,79}$/

export function normalizeWidgetLanguage(
  value: unknown,
  fallback: WidgetLanguage = 'es',
): WidgetLanguage {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase().replace('_', '-')
  if (normalized === 'pt' || normalized.startsWith('pt-')) return 'pt-BR'
  const language = normalized.split('-')[0]
  return isWidgetLanguage(language) ? language : fallback
}

export function normalizeSuggestedQuestions(
  value: unknown,
  fallbackLanguage: unknown = 'es',
): SuggestedQuestion[] {
  if (!Array.isArray(value)) return []

  const language = normalizeWidgetLanguage(fallbackLanguage)
  const seenIds = new Set<string>()
  const questions: SuggestedQuestion[] = []

  for (const item of value) {
    const question = normalizeSuggestedQuestion(item, language)
    if (!question || seenIds.has(question.id)) continue
    seenIds.add(question.id)
    questions.push(question)
    if (questions.length === MAX_SUGGESTED_QUESTIONS) break
  }

  return questions
}

export function mergeSuggestedQuestionsIntoWidgetConfig<T extends Record<string, unknown>>(
  widgetConfig: T,
  questions: SuggestedQuestion[],
) {
  return {
    ...widgetConfig,
    suggestedQuestions: questions,
  }
}

export function parseSuggestedQuestionsFormValue(value: FormDataEntryValue | null):
  | { ok: true; questions: SuggestedQuestion[] }
  | { ok: false; error: string } {
  if (typeof value !== 'string') {
    return { ok: false, error: 'La configuración de preguntas sugeridas no es válida.' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return { ok: false, error: 'La configuración de preguntas sugeridas no es válida.' }
  }

  if (!Array.isArray(parsed) || parsed.length > MAX_SUGGESTED_QUESTIONS) {
    return {
      ok: false,
      error: `Puedes configurar hasta ${MAX_SUGGESTED_QUESTIONS} preguntas sugeridas.`,
    }
  }

  const normalized = normalizeSuggestedQuestions(parsed)
  if (normalized.length !== parsed.length) {
    return {
      ok: false,
      error: `Cada pregunta necesita un identificador único y un texto de hasta ${MAX_SUGGESTED_QUESTION_LENGTH} caracteres. Las reglas contextuales deben contener dominios, rutas o URLs válidos y no repetidos.`,
    }
  }

  return { ok: true, questions: normalized }
}

export function getVisibleSuggestedQuestions(
  questions: SuggestedQuestion[],
  language: unknown,
  pageUrl?: string | null,
): VisibleSuggestedQuestion[] {
  const widgetLanguage = normalizeWidgetLanguage(language)
  const normalizedPageUrl = normalizeComparableUrl(pageUrl)
  const contextual: Omit<VisibleSuggestedQuestion, 'position'>[] = []
  const general: Omit<VisibleSuggestedQuestion, 'position'>[] = []

  for (const question of questions) {
    if (!question.enabled) continue

    if (question.targets.length === 0) {
      general.push({
        id: question.id,
        text: question.text,
        language: widgetLanguage,
        source: 'general',
        matchedTarget: null,
      })
      continue
    }

    const matchedTarget = normalizedPageUrl
      ? question.targets.find((target) => matchesSuggestedQuestionTarget(target, normalizedPageUrl)) ?? null
      : null
    if (!matchedTarget) continue

    contextual.push({
      id: question.id,
      text: question.text,
      language: widgetLanguage,
      source: 'contextual',
      matchedTarget,
    })
  }

  const seenText = new Set<string>()
  return [...contextual, ...general]
    .filter((question) => {
      const key = normalizeVisibleQuestionText(question.text)
      if (seenText.has(key)) return false
      seenText.add(key)
      return true
    })
    .slice(0, MAX_VISIBLE_SUGGESTED_QUESTIONS)
    .map((question, position) => ({ ...question, position }))
}

export function validateSuggestedQuestionSelection(
  questions: SuggestedQuestion[],
  input: SuggestedQuestionSelectionInput | null | undefined,
  message: string,
  fallbackLanguage: unknown,
  pageUrl?: string | null,
): VisibleSuggestedQuestion | null {
  if (!input || typeof input.id !== 'string' || !Number.isInteger(input.position)) return null

  const visible = getVisibleSuggestedQuestions(
    questions,
    fallbackLanguage,
    pageUrl,
  )
  const selected = visible.find((question) => (
    question.id === input.id
    && question.position === input.position
  ))

  return selected?.text === message ? selected : null
}

function normalizeSuggestedQuestion(
  value: unknown,
  fallbackLanguage: WidgetLanguage,
): SuggestedQuestion | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || !SUGGESTED_QUESTION_ID_PATTERN.test(item.id)) return null
  if (typeof item.enabled !== 'boolean') return null

  const text = getSuggestedQuestionText(item, fallbackLanguage)
  if (!text || text.length > MAX_SUGGESTED_QUESTION_LENGTH) return null
  const targets = normalizeSuggestedQuestionTargets(item.targets)
  if (targets === null) return null

  return {
    id: item.id,
    enabled: item.enabled,
    text,
    targets,
  }
}

function normalizeSuggestedQuestionTargets(value: unknown): SuggestedQuestionTarget[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > MAX_SUGGESTED_QUESTION_TARGETS) return null

  const targets: SuggestedQuestionTarget[] = []
  const seen = new Set<string>()

  for (const item of value) {
    const target = normalizeSuggestedQuestionTarget(item)
    if (!target) return null
    const key = `${target.type}:${target.value}`
    if (seen.has(key)) return null
    seen.add(key)
    targets.push(target)
  }

  return targets
}

function normalizeSuggestedQuestionTarget(value: unknown): SuggestedQuestionTarget | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || !SUGGESTED_QUESTION_ID_PATTERN.test(item.id)) return null
  if (!isSuggestedQuestionTargetType(item.type) || typeof item.value !== 'string') return null

  const targetValue = normalizeSuggestedQuestionTargetValue(item.type, item.value)
  if (!targetValue || targetValue.length > MAX_SUGGESTED_QUESTION_TARGET_LENGTH) return null

  return {
    id: item.id,
    type: item.type,
    value: targetValue,
  }
}

function normalizeSuggestedQuestionTargetValue(
  type: SuggestedQuestionTargetType,
  value: string,
) {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (type === 'hostname') {
    try {
      const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
      return url.hostname.toLowerCase()
    } catch {
      return null
    }
  }

  if (type === 'path_prefix') {
    if (!trimmed.startsWith('/')) return null
    try {
      const url = new URL(trimmed, 'https://context.invalid')
      if (url.origin !== 'https://context.invalid' || url.search || url.hash) return null
      return normalizePathname(url.pathname)
    } catch {
      return null
    }
  }

  return normalizeComparableUrl(trimmed)?.href ?? null
}

function matchesSuggestedQuestionTarget(
  target: SuggestedQuestionTarget,
  pageUrl: NormalizedComparableUrl,
) {
  if (target.type === 'hostname') {
    return pageUrl.hostname === target.value
  }

  if (target.type === 'path_prefix') {
    return target.value === '/'
      || pageUrl.pathname === target.value
      || pageUrl.pathname.startsWith(`${target.value}/`)
  }

  return pageUrl.href === target.value
}

type NormalizedComparableUrl = {
  href: string
  hostname: string
  pathname: string
}

function normalizeComparableUrl(value: unknown): NormalizedComparableUrl | null {
  if (typeof value !== 'string' || !value.trim()) return null

  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    url.hash = ''
    removeTrackingParameters(url)
    url.searchParams.sort()
    url.pathname = normalizePathname(url.pathname)

    return {
      href: url.pathname === '/' && !url.search
        ? url.origin
        : url.toString().replace(/\/$/, ''),
      hostname: url.hostname.toLowerCase(),
      pathname: url.pathname,
    }
  } catch {
    return null
  }
}

function normalizePathname(value: string) {
  if (!value || value === '/') return '/'
  return value.replace(/\/+$/, '') || '/'
}

function removeTrackingParameters(url: URL) {
  const trackingParameters = new Set([
    '_ga',
    '_gl',
    'dclid',
    'fbclid',
    'gclid',
    'igshid',
    'mc_cid',
    'mc_eid',
    'msclkid',
    'ttclid',
    'twclid',
    'yclid',
  ])

  for (const key of Array.from(url.searchParams.keys())) {
    const normalizedKey = key.toLowerCase()
    if (normalizedKey.startsWith('utm_') || normalizedKey.startsWith('talia_') || trackingParameters.has(normalizedKey)) {
      url.searchParams.delete(key)
    }
  }
}

function normalizeVisibleQuestionText(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function getSuggestedQuestionText(
  item: Record<string, unknown>,
  fallbackLanguage: WidgetLanguage,
) {
  if (typeof item.text === 'string') return item.text.trim()

  // Backwards-compatible read for the first TAL-38 implementation. The next
  // save rewrites the question to the single-language contract.
  if (!item.translations || typeof item.translations !== 'object' || Array.isArray(item.translations)) {
    return ''
  }

  const translations = item.translations as Record<string, unknown>
  for (const language of uniqueLanguages([fallbackLanguage, ...WIDGET_LANGUAGES])) {
    const text = translations[language]
    if (typeof text === 'string' && text.trim()) return text.trim()
  }

  return ''
}

function isWidgetLanguage(value: string): value is WidgetLanguage {
  return WIDGET_LANGUAGES.includes(value as WidgetLanguage)
}

function isSuggestedQuestionTargetType(value: unknown): value is SuggestedQuestionTargetType {
  return typeof value === 'string'
    && SUGGESTED_QUESTION_TARGET_TYPES.includes(value as SuggestedQuestionTargetType)
}

function uniqueLanguages(languages: readonly WidgetLanguage[]) {
  return languages.filter((language, index) => languages.indexOf(language) === index)
}
