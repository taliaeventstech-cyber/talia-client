import type {
  EmailAgentClassification,
  EmailAgentClassifierProvider,
  EmailAgentDrafterProvider,
  EmailAgentDraft,
  EmailAgentInput,
  EmailAgentPriority,
} from './agent-provider'

type TaliaAiEmailProviderOptions = {
  baseUrl?: string
  apiKey?: string
  fetcher?: typeof fetch
}

export class TaliaAiEmailClassifierProvider implements EmailAgentClassifierProvider {
  private readonly config: Required<TaliaAiEmailProviderOptions>

  constructor(options: TaliaAiEmailProviderOptions = {}) {
    this.config = resolveConfig(options)
  }

  async classify(input: EmailAgentInput) {
    const result = await postTaliaAi(this.config, '/v1/email/classify', buildPayload(input))
    if (!result.ok) return result

    const classification = getRecord(result.body.classification)
    if (!classification) return invalidResponse('classification', result.text)

    return {
      ok: true as const,
      classification: parseClassification(classification, result.body),
    }
  }
}

export class TaliaAiEmailDrafterProvider implements EmailAgentDrafterProvider {
  private readonly config: Required<TaliaAiEmailProviderOptions>

  constructor(options: TaliaAiEmailProviderOptions = {}) {
    this.config = resolveConfig(options)
  }

  async generateDraft(input: EmailAgentInput & { classification: EmailAgentClassification }) {
    const result = await postTaliaAi(this.config, '/v1/email/draft', {
      ...buildPayload(input),
      classification: serializeClassification(input.classification),
    })
    if (!result.ok) return result

    const draft = getRecord(result.body.draft)
    if (!draft) return invalidResponse('draft', result.text)

    return {
      ok: true as const,
      draft: parseDraft(draft, result.body),
    }
  }
}

function resolveConfig(options: TaliaAiEmailProviderOptions) {
  return {
    baseUrl: (options.baseUrl ?? process.env.TALIA_AI_BASE_URL ?? '').replace(/\/$/, ''),
    apiKey: options.apiKey ?? process.env.TALIA_AI_INTERNAL_API_KEY ?? '',
    fetcher: options.fetcher ?? fetch,
  }
}

function buildPayload(input: EmailAgentInput) {
  return {
    tenant_id: input.tenantId,
    connection_id: input.connectionId,
    thread_id: input.threadId,
    message_id: input.messageId,
    mailbox_email: input.mailboxEmail,
    subject: input.subject,
    sender_email: input.senderEmail,
    sender_name: input.senderName,
    body_text: input.bodyText,
    fallback_email: input.fallbackEmail,
    fallback_phone: input.fallbackPhone,
    relevant_knowledge: input.knowledgeHints,
    agent_settings: {
      tone: input.agentSettings.tone,
      draft_style: input.agentSettings.draftStyle,
      signature: input.agentSettings.signature,
      channel_prompt: input.agentSettings.channelPrompt,
      classification_topics: input.agentSettings.classificationTopics,
      human_review_topics: input.agentSettings.humanReviewTopics,
      classification_rules: input.agentSettings.classificationRules,
    },
  }
}

function serializeClassification(classification: EmailAgentClassification) {
  return {
    should_process: classification.shouldProcess,
    should_generate_draft: classification.shouldGenerateDraft,
    needs_human_review: classification.needsHumanReview,
    classification_reason: classification.classificationReason ?? 'other',
    topic: classification.topic,
    priority: classification.priority,
    confidence: classification.confidence ?? 0,
    escalation_reason: classification.escalationReason,
  }
}

async function postTaliaAi(
  config: Required<TaliaAiEmailProviderOptions>,
  path: string,
  payload: Record<string, unknown>,
) {
  if (!config.baseUrl || !config.apiKey) {
    return { ok: false as const, status: 503, error: 'TALIA AI service is not configured' }
  }

  try {
    const response = await config.fetcher(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const text = await response.text()
    const body = parseObject(text)

    if (!response.ok || body?.ok === false) {
      return {
        ok: false as const,
        status: response.status,
        error: pickString(body, 'error') ?? `talia-ai responded with ${response.status}`,
        details: pickString(body, 'details') ?? text,
      }
    }
    if (!body) return { ok: false as const, status: 502, error: 'talia-ai returned invalid JSON', details: text }

    return { ok: true as const, body, text }
  } catch (error) {
    return {
      ok: false as const,
      status: 502,
      error: 'TALIA AI email request failed',
      details: error instanceof Error ? error.message : String(error),
    }
  }
}

function parseClassification(record: Record<string, unknown>, response: Record<string, unknown>): EmailAgentClassification {
  const shouldProcess = pickBoolean(record, 'should_process') ?? false
  return {
    shouldProcess,
    shouldGenerateDraft: shouldProcess && (pickBoolean(record, 'should_generate_draft') ?? false),
    needsHumanReview: shouldProcess && (pickBoolean(record, 'needs_human_review') ?? false),
    classificationReason: pickString(record, 'classification_reason'),
    topic: pickString(record, 'topic'),
    priority: parsePriority(pickString(record, 'priority')),
    confidence: pickNumber(record, 'confidence'),
    escalationReason: pickString(record, 'escalation_reason'),
    raw: { provider: 'talia-ai', metadata: getRecord(response.metadata) },
  }
}

function parseDraft(record: Record<string, unknown>, response: Record<string, unknown>): EmailAgentDraft {
  return {
    shouldGenerateDraft: pickBoolean(record, 'should_generate_draft') ?? false,
    subject: pickString(record, 'subject'),
    bodyText: pickString(record, 'body_text'),
    bodyHtml: pickString(record, 'body_html'),
    topic: pickString(record, 'topic'),
    priority: parsePriority(pickString(record, 'priority')),
    confidence: pickNumber(record, 'confidence'),
    escalationReason: pickString(record, 'escalation_reason'),
    classificationReason: pickString(record, 'classification_reason'),
    raw: { provider: 'talia-ai', metadata: getRecord(response.metadata) },
  }
}

function invalidResponse(expected: string, details: string) {
  return {
    ok: false as const,
    status: 502,
    error: `talia-ai response did not include ${expected}`,
    details,
  }
}

function parseObject(value: string) {
  try {
    return getRecord(JSON.parse(value))
  } catch {
    return null
  }
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function pickString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function pickBoolean(record: Record<string, unknown>, key: string) {
  return typeof record[key] === 'boolean' ? record[key] : null
}

function pickNumber(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parsePriority(value: string | null): EmailAgentPriority {
  return value === 'low' || value === 'high' || value === 'urgent' ? value : 'normal'
}
