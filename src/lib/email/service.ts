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
import { getFreshMicrosoftAccessToken } from './microsoft-tokens'
import { N8nEmailClassifierProvider, N8nEmailDrafterProvider } from './n8n'
import { FallbackEmailClassifierProvider, FallbackEmailDrafterProvider } from './provider-fallback'
import { getEmailAgentProviderTrace, resolveEmailAgentProvider, type EmailAgentProviderSelection } from './provider-selection'
import { createOutlookDraft } from './outlook'
import { getEmailAgentSettings } from './settings'
import { TaliaAiEmailClassifierProvider, TaliaAiEmailDrafterProvider } from './talia-ai'

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
    .select('id, theatre_id, provider, mailbox_email, status, draft_mode, oauth_metadata, metadata')
    .eq('theatre_id', input.tenantId)
    .in('status', ['connected', 'syncing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!connection) {
    return { ok: false as const, error: 'No connected email mailbox for this tenant' }
  }
  const providerSelection = resolveEmailAgentProvider(connection.metadata)

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
        sender_name,
        metadata
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
  const currentThreadMetadata = getJsonRecord((thread as { metadata?: Json | null } | null)?.metadata)
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

  const classifierProvider = getEmailClassifierProvider(connection.metadata, providerSelection)
  if (!classifierProvider.ok) {
    await markEmailThreadProcessingError(admin, {
      threadId: message.thread_id,
      metadata: currentThreadMetadata,
      status: 'escalated',
      phase: 'classifier_config',
      errorKey: 'email_classifier_error',
      error: classifierProvider.error,
      classification: rulesClassification,
    })

    return classifierProvider
  }

  await markEmailThreadProcessingStage(admin, {
    threadId: message.thread_id,
    metadata: currentThreadMetadata,
    phase: 'classifier_requested',
    provider: classifierProvider.providerName,
    endpointUrl: classifierProvider.endpointUrl,
    providerOverride: providerSelection.override,
    fallbackAvailable: classifierProvider.fallbackAvailable,
    classification: rulesClassification,
  })

  const classificationResult = await classifierProvider.provider.classify(agentInput)
  if (!classificationResult.ok) {
    await markEmailThreadProcessingError(admin, {
      threadId: message.thread_id,
      metadata: currentThreadMetadata,
      status: 'escalated',
      phase: 'classifier_failed',
      provider: classifierProvider.providerName,
      endpointUrl: classifierProvider.endpointUrl,
      providerOverride: providerSelection.override,
      fallbackAvailable: classifierProvider.fallbackAvailable,
      errorKey: 'email_classifier_error',
      error: classificationResult.error,
      details: classificationResult.details,
      classification: rulesClassification,
    })

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
      metadata: buildClassificationMetadata(agentClassification, rulesClassification, knowledgeMatches.length, providerSelection),
    })
    .eq('id', message.thread_id)

  if (!agentClassification.shouldProcess || !agentClassification.shouldGenerateDraft || input.createDraft === false || connection.draft_mode === 'disabled') {
    return {
      ok: true as const,
      action: agentClassification.shouldGenerateDraft && (input.createDraft === false || connection.draft_mode === 'disabled')
        ? 'classified' as const
        : 'ignored' as const,
      threadId: message.thread_id,
    }
  }

  const drafterProvider = getEmailDrafterProvider(connection.metadata, providerSelection)
  if (!drafterProvider.ok) {
    await markEmailThreadProcessingError(admin, {
      threadId: message.thread_id,
      metadata: currentThreadMetadata,
      status: 'escalated',
      phase: 'drafter_config',
      errorKey: 'email_agent_error',
      error: drafterProvider.error,
      classification: buildThreadClassificationRecord(combinedClassification),
    })

    return drafterProvider
  }

  await markEmailThreadProcessingStage(admin, {
    threadId: message.thread_id,
    metadata: currentThreadMetadata,
    phase: 'drafter_requested',
    provider: drafterProvider.providerName,
    endpointUrl: drafterProvider.endpointUrl,
    providerOverride: providerSelection.override,
    fallbackAvailable: drafterProvider.fallbackAvailable,
    classification: buildThreadClassificationRecord(combinedClassification),
  })

  const result = await drafterProvider.provider.generateDraft({
    ...agentInput,
    classification: agentClassification,
  })

  if (!result.ok) {
    await markEmailThreadProcessingError(admin, {
      threadId: message.thread_id,
      metadata: currentThreadMetadata,
      status: 'escalated',
      phase: 'drafter_failed',
      provider: drafterProvider.providerName,
      endpointUrl: drafterProvider.endpointUrl,
      providerOverride: providerSelection.override,
      fallbackAvailable: drafterProvider.fallbackAvailable,
      errorKey: 'email_agent_error',
      error: result.error,
      details: result.details,
      classification: buildThreadClassificationRecord(combinedClassification),
    })

    return result
  }

  const draft = result.draft
  const finalTopic = draft.topic ?? agentClassification.topic ?? 'otro'
  const finalPriority = draft.priority === 'normal' ? agentClassification.priority : draft.priority
  if (!draft.shouldGenerateDraft) {
    await admin
      .from('email_threads')
      .update({
        status: 'ignored',
        topic: finalTopic,
        priority: finalPriority,
        metadata: buildDraftMetadata(draft, combinedClassification, knowledgeMatches.length, providerSelection),
      })
      .eq('id', message.thread_id)

    return {
      ok: true as const,
      action: 'ignored' as const,
      threadId: message.thread_id,
    }
  }

  const draftMetadata = buildDraftMetadata(draft, combinedClassification, knowledgeMatches.length, providerSelection)
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
        metadata: draftMetadata,
      })
      .eq('id', message.thread_id),
    recordEmailAgentUsage(admin, {
      tenantId: input.tenantId,
      threadId: message.thread_id,
      inputText: bodyText,
      outputText: draft.bodyText ?? draft.bodyHtml ?? '',
      provider: getEmailAgentProviderTrace(draft.raw, providerSelection).provider,
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
      provider: string
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
        error_message: 'Cannot create provider draft without recipient email',
      })
      .eq('id', input.draftId)

    return {
      ok: false as const,
      error: 'Cannot create provider draft without recipient email',
      draftId: input.draftId,
    }
  }

  let accessToken: string

  try {
    accessToken = input.connection.provider === 'microsoft'
      ? await getFreshMicrosoftAccessToken(admin, input.connection)
      : await getFreshGoogleAccessToken(admin, input.connection)
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
      error: 'Failed to refresh email connection',
      details: message,
      draftId: input.draftId,
    }
  }

  try {
    const providerDraft = input.connection.provider === 'microsoft'
      ? await createOutlookDraft(accessToken, {
        to: input.to,
        subject: input.subject,
        bodyText: input.bodyText,
        bodyHtml: input.bodyHtml,
      })
      : await createGmailDraft(accessToken, {
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
          provider_draft_id: providerDraft.id,
          metadata: {
            ...getJsonRecord(input.metadata),
            mailbox_provider: input.connection.provider,
            provider_draft_id: providerDraft.id,
            provider_thread_id: getProviderDraftThreadId(providerDraft),
            gmail_draft_id: input.connection.provider === 'google' ? providerDraft.id : undefined,
            gmail_message_id: input.connection.provider === 'google' && 'message' in providerDraft ? providerDraft.message?.id ?? null : undefined,
            gmail_thread_id: input.connection.provider === 'google' && 'message' in providerDraft ? providerDraft.message?.threadId ?? null : undefined,
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
          provider: input.connection.provider === 'microsoft' ? 'outlook' : 'gmail',
          tool: input.connection.provider === 'microsoft' ? 'me.messages.create' : 'users.drafts.create',
        },
      }),
    ])

    return {
      ok: true as const,
      providerDraftId: providerDraft.id,
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
      error: 'Failed to create provider draft',
      details: message,
      draftId: input.draftId,
    }
  }
}

function getEmailClassifierProvider(metadata: Json, selection: EmailAgentProviderSelection) {
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

  if (selection.requestedProvider === 'talia-ai') {
    const taliaAiConfig = getTaliaAiEmailConfig('/v1/email/classify')
    if (!taliaAiConfig.ok) return taliaAiConfig

    const primary = new TaliaAiEmailClassifierProvider()
    const provider = webhookUrl
      ? new FallbackEmailClassifierProvider(primary, new N8nEmailClassifierProvider(webhookUrl))
      : primary

    return {
      ok: true as const,
      provider: provider satisfies EmailAgentClassifierProvider,
      providerName: 'talia-ai',
      endpointUrl: taliaAiConfig.endpointUrl,
      fallbackAvailable: Boolean(webhookUrl),
    }
  }

  if (!webhookUrl) {
    return {
      ok: false as const,
      error: 'Email classifier webhook is not configured',
    }
  }

  return {
    ok: true as const,
    provider: new N8nEmailClassifierProvider(webhookUrl) satisfies EmailAgentClassifierProvider,
    providerName: 'n8n',
    endpointUrl: webhookUrl,
    fallbackAvailable: false,
  }
}

function getProviderDraftThreadId(draft: Awaited<ReturnType<typeof createGmailDraft>> | Awaited<ReturnType<typeof createOutlookDraft>>) {
  const record = draft as { message?: { threadId?: string }; conversationId?: string }
  return record.message?.threadId ?? record.conversationId ?? null
}

function getEmailDrafterProvider(metadata: Json, selection: EmailAgentProviderSelection) {
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

  if (selection.requestedProvider === 'talia-ai') {
    const taliaAiConfig = getTaliaAiEmailConfig('/v1/email/draft')
    if (!taliaAiConfig.ok) return taliaAiConfig

    const primary = new TaliaAiEmailDrafterProvider()
    const provider = webhookUrl
      ? new FallbackEmailDrafterProvider(primary, new N8nEmailDrafterProvider(webhookUrl))
      : primary

    return {
      ok: true as const,
      provider: provider satisfies EmailAgentDrafterProvider,
      providerName: 'talia-ai',
      endpointUrl: taliaAiConfig.endpointUrl,
      fallbackAvailable: Boolean(webhookUrl),
    }
  }

  if (!webhookUrl) {
    return {
      ok: false as const,
      error: 'Email drafter webhook is not configured',
    }
  }

  return {
    ok: true as const,
    provider: new N8nEmailDrafterProvider(webhookUrl) satisfies EmailAgentDrafterProvider,
    providerName: 'n8n',
    endpointUrl: webhookUrl,
    fallbackAvailable: false,
  }
}

function getTaliaAiEmailConfig(path: '/v1/email/classify' | '/v1/email/draft') {
  const baseUrl = process.env.TALIA_AI_BASE_URL?.replace(/\/$/, '')
  const apiKey = process.env.TALIA_AI_INTERNAL_API_KEY
  if (!baseUrl || !apiKey) {
    return {
      ok: false as const,
      error: 'TALIA AI email provider is not configured',
    }
  }

  return {
    ok: true as const,
    endpointUrl: `${baseUrl}${path}`,
  }
}

async function markEmailThreadProcessingStage(
  admin: AdminClient,
  input: {
    threadId: string
    metadata: Record<string, Json | undefined>
    phase: string
    provider?: string
    endpointUrl?: string
    providerOverride?: string
    fallbackAvailable?: boolean
    classification?: Json
  },
) {
  await admin
    .from('email_threads')
    .update({
      metadata: buildProcessingMetadata(input.metadata, {
        phase: input.phase,
        provider: input.provider,
        provider_override: input.providerOverride,
        fallback_available: input.fallbackAvailable,
        endpoint_url: sanitizeEndpointUrl(input.endpointUrl),
        last_error: null,
      }, input.classification),
    })
    .eq('id', input.threadId)
}

async function markEmailThreadProcessingError(
  admin: AdminClient,
  input: {
    threadId: string
    metadata: Record<string, Json | undefined>
    status: 'escalated'
    phase: string
    errorKey: 'email_classifier_error' | 'email_agent_error'
    error: string
    details?: string
    provider?: string
    endpointUrl?: string
    providerOverride?: string
    fallbackAvailable?: boolean
    classification?: Json
  },
) {
  await admin
    .from('email_threads')
    .update({
      status: input.status,
      metadata: buildProcessingMetadata(input.metadata, {
        phase: input.phase,
        provider: input.provider,
        provider_override: input.providerOverride,
        fallback_available: input.fallbackAvailable,
        endpoint_url: sanitizeEndpointUrl(input.endpointUrl),
        last_error: input.error,
        last_error_details: truncateDetails(input.details),
      }, input.classification, {
        [input.errorKey]: input.error,
        [`${input.errorKey.replace('_error', '_details')}`]: truncateDetails(input.details),
      }),
    })
    .eq('id', input.threadId)
}

function buildProcessingMetadata(
  currentMetadata: Record<string, Json | undefined>,
  processing: Record<string, Json | undefined>,
  classification?: Json,
  extra?: Record<string, Json | undefined>,
) {
  const previousProcessing = getJsonRecord(currentMetadata.email_processing)

  return {
    ...currentMetadata,
    ...extra,
    classification: classification ?? currentMetadata.classification ?? null,
    email_processing: {
      ...previousProcessing,
      ...processing,
      updated_at: new Date().toISOString(),
    },
  } satisfies Json
}

function sanitizeEndpointUrl(value?: string) {
  if (!value) return null

  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return 'invalid-endpoint-url'
  }
}

function truncateDetails(value?: string) {
  if (!value) return null
  return value.length > 800 ? `${value.slice(0, 800)}...` : value
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
}, classification: CombinedEmailClassification | undefined, knowledgeMatchCount: number, selection: EmailAgentProviderSelection) {
  const providerTrace = getEmailAgentProviderTrace(draft.raw, selection)
  return {
    source: 'email_agent',
    ...providerTrace,
    confidence: draft.confidence,
    escalation_reason: draft.escalationReason,
    knowledge_match_count: knowledgeMatchCount,
    classification: classification ? buildThreadClassificationRecord(classification, draft.classificationReason) : null,
    raw_response: (draft.raw ?? null) as Json,
  } satisfies Json
}

type CombinedEmailClassification = ReturnType<typeof classifyEmailMessage> & {
  shouldGenerateDraft: boolean
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
    shouldGenerateDraft: agentClassification.shouldGenerateDraft,
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
  if (!classification.shouldProcess || !classification.shouldGenerateDraft) return 'ignored'
  return 'new'
}

function buildClassificationMetadata(
  agentClassification: EmailAgentClassification,
  rulesClassification: ReturnType<typeof classifyEmailMessage>,
  knowledgeMatchCount: number,
  selection: EmailAgentProviderSelection,
) {
  const providerTrace = getEmailAgentProviderTrace(agentClassification.raw, selection)
  return {
    source: 'email_classifier',
    ...providerTrace,
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
    shouldGenerateDraft: classification.shouldGenerateDraft,
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

function getJsonRecord(value: Json | undefined | null) {
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
    provider: 'n8n' | 'talia-ai'
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
      provider: input.provider,
    },
  })
}
