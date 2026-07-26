export const WIDGET_LANGUAGES = ['es', 'ca', 'en'] as const
export const MAX_SUGGESTED_QUESTIONS = 6
export const MAX_SUGGESTED_QUESTION_LENGTH = 160

export type WidgetLanguage = (typeof WIDGET_LANGUAGES)[number]

export type SuggestedQuestion = {
  id: string
  enabled: boolean
  text: string
}

export type VisibleSuggestedQuestion = {
  id: string
  text: string
  position: number
  language: WidgetLanguage
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
  const language = value.trim().toLowerCase().split(/[-_]/)[0]
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
      error: `Cada pregunta necesita un identificador único y un texto de hasta ${MAX_SUGGESTED_QUESTION_LENGTH} caracteres.`,
    }
  }

  return { ok: true, questions: normalized }
}

export function getVisibleSuggestedQuestions(
  questions: SuggestedQuestion[],
  language: unknown,
): VisibleSuggestedQuestion[] {
  const widgetLanguage = normalizeWidgetLanguage(language)

  return questions
    .filter((question) => question.enabled)
    .map((question, position) => ({
      id: question.id,
      text: question.text,
      position,
      language: widgetLanguage,
    }))
}

export function validateSuggestedQuestionSelection(
  questions: SuggestedQuestion[],
  input: SuggestedQuestionSelectionInput | null | undefined,
  message: string,
  fallbackLanguage: unknown,
): VisibleSuggestedQuestion | null {
  if (!input || typeof input.id !== 'string' || !Number.isInteger(input.position)) return null

  const visible = getVisibleSuggestedQuestions(
    questions,
    fallbackLanguage,
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

  return {
    id: item.id,
    enabled: item.enabled,
    text,
  }
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

function uniqueLanguages(languages: readonly WidgetLanguage[]) {
  return languages.filter((language, index) => languages.indexOf(language) === index)
}
