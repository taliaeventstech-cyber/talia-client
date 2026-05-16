import type {
  EmailAgentClassification,
  EmailAgentClassifierProvider,
  EmailAgentDrafterProvider,
  EmailAgentDraft,
  EmailAgentInput,
  EmailAgentPriority,
  EmailAgentProvider,
} from './agent-provider'

export class N8nEmailClassifierProvider implements EmailAgentClassifierProvider {
  constructor(private readonly webhookUrl: string) {}

  async classify(input: EmailAgentInput) {
    const result = await postN8n(this.webhookUrl, buildBasePayload(input, 'email_classifier'))
    if (!result.ok) return result

    return {
      ok: true as const,
      classification: parseN8nEmailClassification(result.text),
    }
  }
}

export class N8nEmailDrafterProvider implements EmailAgentDrafterProvider {
  constructor(private readonly webhookUrl: string) {}

  async generateDraft(input: EmailAgentInput & { classification: EmailAgentClassification }) {
    const result = await postN8n(this.webhookUrl, {
      ...buildBasePayload(input, 'email_drafter'),
      classification: input.classification,
    })
    if (!result.ok) return result

    return {
      ok: true as const,
      draft: parseN8nEmailDraft(result.text),
    }
  }
}

export class N8nEmailAgentProvider implements EmailAgentProvider {
  constructor(private readonly webhookUrl: string) {}

  async generateDraft(input: EmailAgentInput) {
    const result = await postN8n(this.webhookUrl, buildBasePayload(input, 'email'))
    if (!result.ok) return result

    return {
      ok: true as const,
      draft: parseN8nEmailDraft(result.text),
    }
  }
}

function buildBasePayload(input: EmailAgentInput, agentType: 'email' | 'email_classifier' | 'email_drafter') {
  return {
    agent_type: agentType,
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
    agent_settings: input.agentSettings,
  }
}

async function postN8n(webhookUrl: string, payload: Record<string, unknown>) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const text = await response.text()

  if (!response.ok) {
    return {
      ok: false as const,
      error: `n8n responded with ${response.status}`,
      details: text,
    }
  }

  return { ok: true as const, text }
}

function parseN8nEmailClassification(text: string): EmailAgentClassification {
  const parsed = parseN8nObject(text)
  if (!parsed.record) return emptyClassification({ raw: parsed.raw })
  const classification = parsed.record.classification && typeof parsed.record.classification === 'object'
    ? parsed.record.classification as Record<string, unknown>
    : parsed.record
  const shouldProcess = pickBoolean(classification, ['should_process', 'shouldProcess', 'actionable']) ?? true
  const shouldReply = shouldProcess === false
    ? false
    : pickBoolean(classification, ['should_reply', 'shouldReply', 'reply_needed']) ?? false

  return {
    shouldProcess,
    shouldReply,
    needsHumanReview: pickBoolean(classification, ['needs_human_review', 'needsHumanReview', 'requires_human']) ?? false,
    topic: pickString(classification, ['topic', 'category', 'intent']),
    priority: parsePriority(pickString(classification, ['priority'])),
    confidence: pickNumber(classification, ['confidence', 'score']),
    escalationReason: pickString(classification, ['escalation_reason', 'escalationReason']),
    classificationReason: pickString(classification, ['classification_reason', 'classificationReason', 'reason', 'decision_reason']),
    raw: parsed.raw,
  }
}

function parseN8nEmailDraft(text: string): EmailAgentDraft {
  const parsed = parseN8nObject(text)
  if (!parsed.record) return emptyDraft({ raw: parsed.raw })
  const draft = parsed.record.draft && typeof parsed.record.draft === 'object'
    ? parsed.record.draft as Record<string, unknown>
    : parsed.record

  const bodyText = pickString(draft, ['body_text', 'bodyText', 'body', 'reply', 'answer', 'text'])
  const bodyHtml = pickString(draft, ['body_html', 'bodyHtml', 'html'])
  const shouldProcess = pickBoolean(draft, ['should_process', 'shouldProcess', 'actionable'])
  const shouldReply = shouldProcess === false
    ? false
    : pickBoolean(draft, ['should_reply', 'shouldReply', 'reply_needed']) ?? Boolean(bodyText || bodyHtml)

  return {
    shouldReply,
    subject: pickString(draft, ['subject', 'generated_subject', 'generatedSubject']),
    bodyText,
    bodyHtml,
    topic: pickString(draft, ['topic', 'category', 'intent']),
    priority: parsePriority(pickString(draft, ['priority'])),
    confidence: pickNumber(draft, ['confidence', 'score']),
    escalationReason: pickString(draft, ['escalation_reason', 'escalationReason']),
    classificationReason: pickString(draft, ['classification_reason', 'classificationReason', 'reason', 'decision_reason']),
    raw: parsed.raw,
  }
}

function parseN8nObject(text: string): { raw: unknown; record: Record<string, unknown> | null } {
  if (!text) return { raw: text, record: null }

  try {
    const parsed = JSON.parse(text)
    const value = Array.isArray(parsed) ? parsed[0] : parsed
    if (!value || typeof value !== 'object') return { raw: parsed, record: null }
    return { raw: parsed, record: value as Record<string, unknown> }
  } catch {
    return { raw: text, record: { body_text: text, should_reply: true } }
  }
}

function emptyClassification(input: { raw: unknown }): EmailAgentClassification {
  return {
    shouldProcess: false,
    shouldReply: false,
    needsHumanReview: false,
    topic: null,
    priority: 'normal',
    confidence: null,
    escalationReason: null,
    classificationReason: null,
    raw: input.raw,
  }
}

function emptyDraft(input: { raw: unknown }): EmailAgentDraft {
  return {
    shouldReply: false,
    subject: null,
    bodyText: null,
    bodyHtml: null,
    topic: null,
    priority: 'normal',
    confidence: null,
    escalationReason: null,
    classificationReason: null,
    raw: input.raw,
  }
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return null
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number') return value
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value)
  }

  return null
}

function pickBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
  }

  return null
}

function parsePriority(value: string | null): EmailAgentPriority {
  if (value === 'low' || value === 'normal' || value === 'high' || value === 'urgent') return value
  return 'normal'
}
