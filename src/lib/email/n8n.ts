import type { EmailAgentDraft, EmailAgentInput, EmailAgentProvider, EmailAgentPriority } from './agent-provider'

export class N8nEmailAgentProvider implements EmailAgentProvider {
  constructor(private readonly webhookUrl: string) {}

  async generateDraft(input: EmailAgentInput) {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_type: 'email',
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
      }),
    })

    const text = await response.text()

    if (!response.ok) {
      return {
        ok: false as const,
        error: `n8n responded with ${response.status}`,
        details: text,
      }
    }

    return {
      ok: true as const,
      draft: parseN8nEmailDraft(text),
    }
  }
}

function parseN8nEmailDraft(text: string): EmailAgentDraft {
  if (!text) return emptyDraft({ raw: text })

  try {
    const parsed = JSON.parse(text)
    const value = Array.isArray(parsed) ? parsed[0] : parsed
    if (!value || typeof value !== 'object') return emptyDraft({ raw: parsed })

    const record = value as Record<string, unknown>
    const draft = record.draft && typeof record.draft === 'object'
      ? record.draft as Record<string, unknown>
      : record

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
      raw: parsed,
    }
  } catch {
    return {
      shouldReply: true,
      subject: null,
      bodyText: text,
      bodyHtml: null,
      topic: null,
      priority: 'normal',
      confidence: null,
      escalationReason: null,
      classificationReason: null,
      raw: text,
    }
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
