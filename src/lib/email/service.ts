import type { createAdminClient } from '@/lib/supabase/admin'
import { searchTenantKnowledge } from '@/lib/knowledge/service'
import {
  estimateOpenAiTextCostCents,
  estimateTokenCount,
  recordUsageEvent,
} from '@/lib/usage/service'
import type { Json } from '@/types/database.types'
import type { EmailAgentClassification, EmailAgentClassifierProvider, EmailAgentDrafterProvider } from './agent-provider'
import { applyEmailClassificationSafeguards } from './classification-safeguards'
import { classifyEmailMessage } from './classifier'
import { createGmailDraft } from './gmail'
import { getFreshGoogleAccessToken } from './google-tokens'
import { N8nEmailClassifierProvider, N8nEmailDrafterProvider } from './n8n'
import { getEmailAgentSettings } from './settings'

type AdminClient = ReturnType<typeof createAdminClient>

export type ProcessEmailInput = {
  tenantId: string
  threadId?: string
  messageId?: string
  createDraft?: boolean
}

export async function processEmailMessage(admin: AdminClient, input: ProcessEmailInput) {
  const { data: connection } = await admin
    .from('email_connections')
    .select('id, theatre_id, mailbox_email, status, draft_mode, oauth_metadata, metadata')
    .eq('theatre_id', input.tenantId)
    .in('status', ['connected', 'syncing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!connection) {
    return { ok: false as const, error: 'No connected email mailbox for this tenant' }
  }

  const messageQuery = admin
    .from('email_messages')
    .select(`
      id,
      theatre_id,
      connection_id,
      thread_id,
      provider_message_id,
      from_email,
      from_name,
      body_text,
      metadata,
      received_at,
      email_threads!inner(
        id,
        subject,
        sender_email,
        sender_name
      )
    `)
    .eq('theatre_id', input.tenantId)
    .eq('connection_id', connection.id)
    .eq('direction', 'inbound')
    .order('received_at', { ascending: false, nullsFirst: false })
    .limit(1)

  if (input.threadId) messageQuery.eq('thread_id', input.threadId)
  if (!input.threadId) messageQuery.eq('email_threads.status', 'new')
  if (input.messageId) messageQuery.eq('id', input.messageId)

  const { data: message, error: messageError } = await messageQuery.maybeSingle()

  if (messageError || !message) {
    return {
      ok: false as const,
      error: 'No inbound email message found to process',
      details: messageError?.message,
    }
  }

  const bodyText = message.body_text?.trim()
  if (!bodyText) {
    return { ok: false as const, error: 'Inbound email has no text body to process' }
  }

  const thread = Array.isArray(message.email_threads)
    ? message.email_threads[0]
    : message.email_threads
  const rulesClassification = classifyEmailMessage({
    subject: thread?.subject ?? null,
    senderEmail: message.from_email ?? thread?.sender_email ?? null,
    bodyText,
    messageMetadata: message.metadata,
    connectionMetadata: connection.metadata,
  })

  if (!rulesClassification.shouldProcess) {
    await admin
      .from('email_threads')
      .update({
        status: 'ignored',
        metadata: {
          source: 'email_classifier',
          classification: rulesClassification,
        } satisfies Json,
      })
      .eq('id', message.thread_id)

    return {
      ok: true as const,
      action: 'ignored' as const,
      threadId: message.thread_id,
    }
  }

  const [{ data: theatre }, knowledgeMatches] = await Promise.all([
    admin
      .from('theatres')
      .select('fallback_email, fallback_phone')
      .eq('id', input.tenantId)
      .maybeSingle(),
    searchTenantKnowledge(admin, input.tenantId, bodyText),
  ])

  const agentSettings = getEmailAgentSettings(connection.metadata)
  const agentInput = {
    tenantId: input.tenantId,
    connectionId: connection.id,
    threadId: message.thread_id,
    messageId: message.id,
    mailboxEmail: connection.mailbox_email,
    subject: thread?.subject ?? null,
    senderEmail: message.from_email ?? thread?.sender_email ?? null,
    senderName: message.from_name ?? thread?.sender_name ?? null,
    bodyText,
    fallbackEmail: theatre?.fallback_email ?? null,
    fallbackPhone: theatre?.fallback_phone ?? null,
    agentSettings,
    knowledgeHints: knowledgeMatches.slice(0, 5).map((match) => ({
      question: match.question,
      answer: match.answer,
      category: match.category,
      priority: match.priority,
    })),
  }

  const classifierProvider = getEmailClassifierProvider(connection.metadata)
  if (!classifierProvider.ok) return classifierProvider

  const classificationResult = await classifierProvider.provider.classify(agentInput)
  if (!classificationResult.ok) {
    await admin
      .from('email_threads')
      .update({
        status: 'escalated',
        metadata: {
          email_classifier_error: classificationResult.error,
          email_classifier_details: classificationResult.details ?? null,
          classification: rulesClassification,
        } satisfies Json,
      })
      .eq('id', message.thread_id)

    return classificationResult
  }

  const agentClassification = applyEmailClassificationSafeguards({
    subject: thread?.subject ?? null,
    bodyText,
    rulesClassification,
    agentClassification: classificationResult.classification,
  })
  const combinedClassification = mergeClassifications(rulesClassification, agentClassification)
  await admin
    .from('email_threads')
    .update({
      status: getClassifiedThreadStatus(agentClassification),
      topic: agentClassification.topic ?? 'otro',
      priority: agentClassification.priority,
      metadata: buildClassificationMetadata(agentClassification, rulesClassification, knowledgeMatches.length),
    })
    .eq('id', message.thread_id)

  if (!agentClassification.shouldProcess || !agentClassification.shouldReply || input.createDraft === false || connection.draft_mode === 'disabled') {
    return {
      ok: true as const,
      action: agentClassification.shouldReply && (input.createDraft === false || connection.draft_mode === 'disabled')
        ? 'classified' as const
        : 'ignored' as const,
      threadId: message.thread_id,
    }
  }

  const drafterProvider = getEmailDrafterProvider(connection.metadata)
  if (!drafterProvider.ok) return drafterProvider

  const result = await drafterProvider.provider.generateDraft({
    ...agentInput,
    classification: agentClassification,
  })

  if (!result.ok) {
    await admin
      .from('email_threads')
      .update({
        status: 'escalated',
        metadata: {
          email_agent_error: result.error,
          email_agent_details: result.details ?? null,
          classification: buildThreadClassificationRecord(combinedClassification),
        },
      })
      .eq('id', message.thread_id)

    return result
  }

  const draft = result.draft
  const finalTopic = draft.topic ?? agentClassification.topic ?? 'otro'
  const finalPriority = draft.priority === 'normal' ? agentClassification.priority : draft.priority
  if (!draft.shouldReply) {
    await admin
      .from('email_threads')
      .update({
        status: 'ignored',
        topic: finalTopic,
        priority: finalPriority,
        metadata: buildDraftMetadata(draft, combinedClassification, knowledgeMatches.length),
      })
      .eq('id', message.thread_id)

    return {
      ok: true as const,
      action: 'ignored' as const,
      threadId: message.thread_id,
    }
  }

  const draftMetadata = buildDraftMetadata(draft, combinedClassification, knowledgeMatches.length)
  const { data: createdDraft, error: draftError } = await admin
    .from('email_drafts')
    .insert({
      theatre_id: input.tenantId,
      connection_id: connection.id,
      thread_id: message.thread_id,
      status: 'generated',
      generated_subject: draft.subject ?? buildReplySubject(thread?.subject ?? null),
      generated_body_text: draft.bodyText,
      generated_body_html: draft.bodyHtml,
      metadata: draftMetadata,
    })
    .select('id')
    .single()

  if (draftError || !createdDraft) {
    return {
      ok: false as const,
      error: 'Failed to persist generated email draft',
      details: draftError?.message,
    }
  }

  await Promise.all([
    admin
      .from('email_threads')
      .update({
        status: 'drafted',
        topic: finalTopic,
        priority: finalPriority,
        metadata: {
          source: 'email_agent',
          knowledge_match_count: knowledgeMatches.length,
          classification: buildThreadClassificationRecord(combinedClassification, draft.classificationReason),
        } satisfies Json,
      })
      .eq('id', message.thread_id),
    recordEmailAgentUsage(admin, {
      tenantId: input.tenantId,
      threadId: message.thread_id,
      inputText: bodyText,
      outputText: draft.bodyText ?? draft.bodyHtml ?? '',
    }),
  ])

  if (connection.draft_mode === 'provider_drafts') {
    const providerDraft = await createProviderDraft(admin, {
      connection,
      draftId: createdDraft.id,
      tenantId: input.tenantId,
      threadId: message.thread_id,
      to: message.from_email ?? thread?.sender_email ?? null,
      subject: draft.subject ?? buildReplySubject(thread?.subject ?? null),
      bodyText: draft.bodyText ?? '',
      bodyHtml: draft.bodyHtml,
      metadata: draftMetadata,
    })

    if (!providerDraft.ok) return providerDraft

    return {
      ok: true as const,
      action: 'provider_draft_created' as const,
      threadId: message.thread_id,
      draftId: createdDraft.id,
      providerDraftId: providerDraft.providerDraftId,
    }
  }

  return {
    ok: true as const,
    action: 'draft_generated' as const,
    threadId: message.thread_id,
    draftId: createdDraft.id,
  }
}

async function createProviderDraft(
  admin: AdminClient,
  input: {
    connection: {
      id: string
      oauth_metadata: Json
    }
    draftId: string
    tenantId: string
    threadId: string
    to: string | null
    subject: string
    bodyText: string
    bodyHtml: string | null | undefined
    metadata: Json
  },
) {
  if (!input.to) {
    await admin
      .from('email_drafts')
      .update({
        status: 'error',
        error_message: 'Cannot create Gmail draft without recipient email',
      })
      .eq('id', input.draftId)

    return {
      ok: false as const,
      error: 'Cannot create Gmail draft without recipient email',
      draftId: input.draftId,
    }
  }

  let accessToken: string

  try {
    accessToken = await getFreshGoogleAccessToken(admin, input.connection)
  } catch (error) {
    const message = getErrorMessage(error)
    await Promise.all([
      admin
        .from('email_connections')
        .update({
          status: 'error',
          error_message: message,
        })
        .eq('id', input.connection.id),
      admin
        .from('email_drafts')
        .update({
          status: 'error',
          error_message: message,
        })
        .eq('id', input.draftId),
    ])

    return {
      ok: false as const,
      error: 'Failed to refresh Gmail connection',
      details: message,
      draftId: input.draftId,
    }
  }

  try {
    const gmailDraft = await createGmailDraft(accessToken, {
      to: input.to,
      subject: input.subject,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml,
    })

    await Promise.all([
      admin
        .from('email_drafts')
        .update({
          status: 'created_in_provider',
          provider_draft_id: gmailDraft.id,
          metadata: {
            ...getJsonRecord(input.metadata),
            mailbox_provider: 'google',
            gmail_draft_id: gmailDraft.id,
            gmail_message_id: gmailDraft.message?.id ?? null,
            gmail_thread_id: gmailDraft.message?.threadId ?? null,
          } satisfies Json,
          error_message: null,
        })
        .eq('id', input.draftId),
      recordUsageEvent(admin, {
        tenantId: input.tenantId,
        moduleKey: 'email',
        channel: 'email',
        eventType: 'tool_call',
        unit: 'call',
        metadata: {
          thread_id: input.threadId,
          draft_id: input.draftId,
          source: 'email_agent',
          provider: 'gmail',
          tool: 'users.drafts.create',
        },
      }),
    ])

    return {
      ok: true as const,
      providerDraftId: gmailDraft.id,
    }
  } catch (error) {
    const message = getErrorMessage(error)
    await admin
      .from('email_drafts')
      .update({
        status: 'error',
        error_message: message,
      })
      .eq('id', input.draftId)

    return {
      ok: false as const,
      error: 'Failed to create Gmail draft',
      details: message,
      draftId: input.draftId,
    }
  }
}

function getEmailClassifierProvider(metadata: Json) {
  const metadataRecord = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, Json | undefined>
    : {}
  const webhookFromMetadata = typeof metadataRecord.n8n_email_classifier_webhook_url === 'string'
    ? metadataRecord.n8n_email_classifier_webhook_url
    : null
  const legacyWebhook = typeof metadataRecord.n8n_email_agent_webhook_url === 'string'
    ? metadataRecord.n8n_email_agent_webhook_url
    : null
  const webhookUrl = webhookFromMetadata
    ?? process.env.DEFAULT_N8N_EMAIL_CLASSIFIER_WEBHOOK_URL
    ?? legacyWebhook
    ?? process.env.DEFAULT_N8N_EMAIL_AGENT_WEBHOOK_URL

  if (!webhookUrl) {
    return {
      ok: false as const,
      error: 'Email classifier webhook is not configured',
    }
  }

  return {
    ok: true as const,
    provider: new N8nEmailClassifierProvider(webhookUrl) satisfies EmailAgentClassifierProvider,
  }
}

function getEmailDrafterProvider(metadata: Json) {
  const metadataRecord = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, Json | undefined>
    : {}
  const webhookFromMetadata = typeof metadataRecord.n8n_email_drafter_webhook_url === 'string'
    ? metadataRecord.n8n_email_drafter_webhook_url
    : null
  const legacyWebhook = typeof metadataRecord.n8n_email_agent_webhook_url === 'string'
    ? metadataRecord.n8n_email_agent_webhook_url
    : null
  const webhookUrl = webhookFromMetadata
    ?? process.env.DEFAULT_N8N_EMAIL_DRAFTER_WEBHOOK_URL
    ?? legacyWebhook
    ?? process.env.DEFAULT_N8N_EMAIL_AGENT_WEBHOOK_URL

  if (!webhookUrl) {
    return {
      ok: false as const,
      error: 'Email drafter webhook is not configured',
    }
  }

  return {
    ok: true as const,
    provider: new N8nEmailDrafterProvider(webhookUrl) satisfies EmailAgentDrafterProvider,
  }
}

function buildReplySubject(subject: string | null) {
  if (!subject) return 'Resposta de TALIA'
  return subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`
}

function buildDraftMetadata(draft: {
  confidence: number | null
  escalationReason: string | null
  classificationReason: string | null
  raw?: unknown
}, classification?: CombinedEmailClassification, knowledgeMatchCount = 0) {
  return {
    source: 'email_agent',
    provider: 'n8n',
    confidence: draft.confidence,
    escalation_reason: draft.escalationReason,
    knowledge_match_count: knowledgeMatchCount,
    classification: classification ? buildThreadClassificationRecord(classification, draft.classificationReason) : null,
    raw_response: (draft.raw ?? null) as Json,
  } satisfies Json
}

type CombinedEmailClassification = ReturnType<typeof classifyEmailMessage> & {
  shouldReply: boolean
  needsHumanReview: boolean
  topic: string | null
  priority: EmailAgentClassification['priority']
  escalationReason: string | null
  agentConfidence: number | null
  agentReason: string | null
  rawAgentResponse?: unknown
}

function mergeClassifications(
  rulesClassification: ReturnType<typeof classifyEmailMessage>,
  agentClassification: EmailAgentClassification,
): CombinedEmailClassification {
  return {
    ...rulesClassification,
    shouldProcess: rulesClassification.shouldProcess && agentClassification.shouldProcess,
    confidence: rulesClassification.confidence,
    shouldReply: agentClassification.shouldReply,
    needsHumanReview: agentClassification.needsHumanReview,
    topic: agentClassification.topic,
    priority: agentClassification.priority,
    escalationReason: agentClassification.escalationReason,
    agentConfidence: agentClassification.confidence,
    agentReason: agentClassification.classificationReason,
    rawAgentResponse: agentClassification.raw,
  }
}

function getClassifiedThreadStatus(classification: EmailAgentClassification) {
  if (classification.needsHumanReview) return 'waiting_human'
  if (!classification.shouldProcess || !classification.shouldReply) return 'ignored'
  return 'new'
}

function buildClassificationMetadata(
  agentClassification: EmailAgentClassification,
  rulesClassification: ReturnType<typeof classifyEmailMessage>,
  knowledgeMatchCount: number,
) {
  return {
    source: 'email_classifier',
    provider: 'n8n',
    confidence: agentClassification.confidence,
    escalation_reason: agentClassification.escalationReason,
    knowledge_match_count: knowledgeMatchCount,
    classification: buildThreadClassificationRecord(mergeClassifications(rulesClassification, agentClassification)),
    raw_response: (agentClassification.raw ?? null) as Json,
  } satisfies Json
}

function buildThreadClassificationRecord(classification: CombinedEmailClassification, draftReason?: string | null) {
  return {
    shouldProcess: classification.shouldProcess,
    shouldReply: classification.shouldReply,
    needsHumanReview: classification.needsHumanReview,
    reason: classification.reason,
    source: classification.source,
    confidence: classification.confidence,
    topic: classification.topic,
    priority: classification.priority,
    escalationReason: classification.escalationReason,
    agent_confidence: classification.agentConfidence,
    agent_reason: draftReason ?? classification.agentReason,
  } satisfies Json
}

function getJsonRecord(value: Json) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {}
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function recordEmailAgentUsage(
  admin: AdminClient,
  input: {
    tenantId: string
    threadId: string
    inputText: string
    outputText: string
  },
) {
  const inputTokens = estimateTokenCount(input.inputText)
  const outputTokens = estimateTokenCount(input.outputText)

  await recordUsageEvent(admin, {
    tenantId: input.tenantId,
    moduleKey: 'email',
    channel: 'email',
    eventType: 'ai_call',
    unit: 'call',
    inputTokens,
    outputTokens,
    costEstimateCents: estimateOpenAiTextCostCents(inputTokens, outputTokens, 'gpt-4o'),
    metadata: {
      thread_id: input.threadId,
      source: 'email_agent',
      provider: 'n8n',
    },
  })
}
