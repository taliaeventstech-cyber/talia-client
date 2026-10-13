import {
  buildClearViewSystemPrompt,
  clearViewJsonSchema,
  clearViewResponseSchema,
  type ClearViewProvider,
  type ClearViewRequest,
} from './clear-view'

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

export class OpenAIClearViewProvider implements ClearViewProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string = DEFAULT_OPENAI_BASE_URL,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async generate(input: ClearViewRequest) {
    const response = await this.fetcher(`${this.baseUrl.replace(/\/+$/, '')}/responses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        store: false,
        input: [
          {
            role: 'system',
            content: buildClearViewSystemPrompt(input.language),
          },
          {
            role: 'user',
            content: JSON.stringify({
              url: input.url,
              page: input.page,
            }),
          },
        ],
        reasoning: { effort: 'low' },
        text: {
          verbosity: 'low',
          format: {
            type: 'json_schema',
            name: 'talia_clear_view',
            strict: true,
            schema: clearViewJsonSchema,
          },
        },
      }),
    })

    const body = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        ok: false as const,
        error: `OpenAI responded with ${response.status}`,
        details: getErrorDetails(body),
      }
    }

    const outputText = extractOutputText(body)
    if (!outputText) {
      return {
        ok: false as const,
        error: 'OpenAI response did not include output text',
      }
    }

    try {
      const parsed = clearViewResponseSchema.parse(JSON.parse(outputText))
      return { ok: true as const, clearView: parsed }
    } catch (error) {
      return {
        ok: false as const,
        error: 'OpenAI response did not match clear-view schema',
        details: error instanceof Error ? error.message : undefined,
      }
    }
  }
}

export function createClearViewProviderFromEnv() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  return new OpenAIClearViewProvider(
    apiKey,
    process.env.OPENAI_ACCESSIBILITY_MODEL || 'gpt-5.5',
    process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL,
  )
}

function extractOutputText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null

  const directOutput = (body as { output_text?: unknown }).output_text
  if (typeof directOutput === 'string' && directOutput.trim()) return directOutput

  const output = (body as { output?: unknown }).output
  if (!Array.isArray(output)) return null

  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const content = (item as { content?: unknown }).content
    if (!Array.isArray(content)) continue

    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== 'object') continue
      const text = (contentItem as { text?: unknown }).text
      if (typeof text === 'string' && text.trim()) return text
    }
  }

  return null
}

function getErrorDetails(body: unknown) {
  if (!body || typeof body !== 'object') return undefined
  const error = (body as { error?: unknown }).error
  if (!error || typeof error !== 'object') return JSON.stringify(body)
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' ? message : JSON.stringify(error)
}
