import { z } from 'zod'

const languageSchema = z.enum(['es', 'ca', 'en'])

const actionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  href: z.string().trim().min(1).max(1000),
})

const sectionTypeSchema = z.enum([
  'important',
  'steps',
  'dates',
  'location',
  'pricing',
  'accessibility',
  'contact',
  'other',
])

const sectionSchema = z.object({
  type: sectionTypeSchema.default('other'),
  title: z.string().trim().min(1).max(120),
  items: z.array(z.string().trim().min(1).max(240)).max(6),
})

export const extractedClearViewSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.array(z.string().trim().min(1).max(300)).max(8),
  actions: z.array(actionSchema).max(8),
  sections: z.array(sectionSchema).max(8),
})

export const clearViewRequestSchema = z.object({
  tenantId: z.string().uuid(),
  url: z.string().trim().url().max(1000),
  language: languageSchema,
  page: extractedClearViewSchema,
})

export const clearViewResponseSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.array(z.string().trim().min(1).max(240)).max(4),
  actions: z.array(actionSchema).max(6),
  sections: z.array(sectionSchema).max(6),
  warnings: z.array(z.string().trim().min(1).max(180)).max(4),
})

export type ClearViewRequest = z.infer<typeof clearViewRequestSchema>
export type ClearViewResponse = z.infer<typeof clearViewResponseSchema>

export type ClearViewProviderResult =
  | { ok: true; clearView: ClearViewResponse }
  | { ok: false; error: string; details?: string }

export interface ClearViewProvider {
  generate(input: ClearViewRequest): Promise<ClearViewProviderResult>
}

export async function generateClearView(
  input: ClearViewRequest,
  provider: ClearViewProvider,
) {
  const result = await provider.generate(input)
  if (!result.ok) return result

  return {
    ok: true as const,
    clearView: sanitizeClearViewResponse(result.clearView, input.page.actions),
  }
}

export function sanitizeClearViewResponse(
  value: ClearViewResponse,
  allowedActions: ClearViewRequest['page']['actions'],
): ClearViewResponse {
  const allowedHrefs = new Set(allowedActions.map((action) => action.href))
  const parsed = clearViewResponseSchema.safeParse(value)
  const fallback = buildLocalClearViewFallback({
    title: '',
    summary: [],
    actions: [],
    sections: [],
  })
  const clearView = parsed.success ? parsed.data : fallback

  return {
    title: clearView.title,
    summary: uniqueStrings(clearView.summary).slice(0, 4),
    actions: clearView.actions
      .filter((action) => allowedHrefs.has(action.href))
      .filter(uniqueActionPredicate())
      .slice(0, 6),
    sections: clearView.sections
      .map((section) => ({
        type: section.type,
        title: section.title,
        items: uniqueStrings(section.items).slice(0, 6),
      }))
      .filter((section) => section.items.length > 0)
      .slice(0, 6),
    warnings: uniqueStrings(clearView.warnings).slice(0, 4),
  }
}

export function buildLocalClearViewFallback(page: ClearViewRequest['page']): ClearViewResponse {
  return {
    title: page.title || 'Información clara',
    summary: page.summary.slice(0, 4),
    actions: page.actions.slice(0, 6),
    sections: page.sections.map((section) => ({
      ...section,
      type: section.type ?? 'other',
    })).slice(0, 6),
    warnings: [],
  }
}

export function buildClearViewSystemPrompt(language: ClearViewRequest['language']) {
  const languageLabel = language === 'ca' ? 'catalan' : language === 'en' ? 'english' : 'spanish'

  return [
    'You are TALIA Accessibility.',
    'Transform public website content into a clear, brief, low-cognitive-load reading view.',
    `Write in ${languageLabel}.`,
    'Prioritize: what this page is about, the most useful actions, key information, practical next steps, dates, location, pricing, accessibility, and contact when present.',
    'Classify each section with one of these universal types: important, steps, dates, location, pricing, accessibility, contact, other.',
    'If the page appears cultural, prioritize events, tickets, opening times, visit information, accessibility, and how to get there.',
    'If the page appears ecommerce, prioritize product, price, shipping, returns, support, and checkout actions.',
    'If the page appears public-service or institutional, prioritize procedures, requirements, dates, location, documents, and contact.',
    'If the page type is unclear, use general important information and steps.',
    'Use plain language and short sentences.',
    'Do not invent information.',
    'Do not create new links.',
    'Only keep action href values that exist in the input actions.',
    'Do not promise legal accessibility compliance.',
    'Return only data matching the JSON schema.',
  ].join('\n')
}

export const clearViewJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'actions', 'sections', 'warnings'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 120 },
    summary: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string', minLength: 1, maxLength: 240 },
    },
    actions: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'href'],
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 80 },
          href: { type: 'string', minLength: 1, maxLength: 1000 },
        },
      },
    },
    sections: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'title', 'items'],
        properties: {
          type: {
            type: 'string',
            enum: ['important', 'steps', 'dates', 'location', 'pricing', 'accessibility', 'contact', 'other'],
          },
          title: { type: 'string', minLength: 1, maxLength: 120 },
          items: {
            type: 'array',
            maxItems: 6,
            items: { type: 'string', minLength: 1, maxLength: 240 },
          },
        },
      },
    },
    warnings: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string', minLength: 1, maxLength: 180 },
    },
  },
} as const

function uniqueStrings(values: string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = value.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function uniqueActionPredicate() {
  const seen = new Set<string>()

  return (action: ClearViewResponse['actions'][number]) => {
    const key = `${action.href}|${action.label.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }
}
