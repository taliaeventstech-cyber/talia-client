import type {
  EmailAgentClassifierProvider,
  EmailAgentDrafterProvider,
  EmailAgentInput,
} from './agent-provider'

export class FallbackEmailClassifierProvider implements EmailAgentClassifierProvider {
  constructor(
    private readonly primary: EmailAgentClassifierProvider,
    private readonly fallback: EmailAgentClassifierProvider,
  ) {}

  async classify(input: EmailAgentInput) {
    const primaryResult = await this.primary.classify(input)
    if (primaryResult.ok) return primaryResult
    if (!isTransient(primaryResult.status)) return primaryResult

    const fallbackResult = await this.fallback.classify(input)
    if (!fallbackResult.ok) {
      return {
        ok: false as const,
        error: primaryResult.error,
        details: [primaryResult.details, `Fallback failed: ${fallbackResult.error}`, fallbackResult.details]
          .filter(Boolean)
          .join('\n'),
      }
    }

    return {
      ok: true as const,
      classification: {
        ...fallbackResult.classification,
        raw: {
          provider: 'n8n',
          fallback_from: 'talia-ai',
          primary_error: primaryResult.error,
          response: fallbackResult.classification.raw ?? null,
        },
      },
    }
  }
}

export class FallbackEmailDrafterProvider implements EmailAgentDrafterProvider {
  constructor(
    private readonly primary: EmailAgentDrafterProvider,
    private readonly fallback: EmailAgentDrafterProvider,
  ) {}

  async generateDraft(input: Parameters<EmailAgentDrafterProvider['generateDraft']>[0]) {
    const primaryResult = await this.primary.generateDraft(input)
    if (primaryResult.ok) return primaryResult
    if (!isTransient(primaryResult.status)) return primaryResult

    const fallbackResult = await this.fallback.generateDraft(input)
    if (!fallbackResult.ok) {
      return {
        ok: false as const,
        error: primaryResult.error,
        details: [primaryResult.details, `Fallback failed: ${fallbackResult.error}`, fallbackResult.details]
          .filter(Boolean)
          .join('\n'),
      }
    }

    return {
      ok: true as const,
      draft: {
        ...fallbackResult.draft,
        raw: {
          provider: 'n8n',
          fallback_from: 'talia-ai',
          primary_error: primaryResult.error,
          response: fallbackResult.draft.raw ?? null,
        },
      },
    }
  }
}

function isTransient(status?: number) {
  return status === undefined || status === 408 || status === 429 || status >= 500
}
