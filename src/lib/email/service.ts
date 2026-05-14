import type { createAdminClient } from '@/lib/supabase/admin'
import { searchTenantKnowledge } from '@/lib/knowledge/service'
import {
  estimateOpenAiTextCostCents,
  estimateTokenCount,
  recordUsageEvent,
} from '@/lib/usage/service'
import type { Json } from '@/types/database.types'
import type { EmailAgentProvider } from './agent-provider'
import { classifyEmailMessage } from './classifier'
import { createGmailDraft } from './gmail'
import {
  decryptOAuthTokens,
  encryptOAuthTokens,
  refreshGoogleAccessToken,
} from './google-oauth'
import { N8nEmailAgentProvider } from './n8n'

type AdminClient = ReturnType<typeof createAdminClient>

export type ProcessEmailInput = {
  tenantId: string
  threadId?: string
  messageId?: string
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

  if (connection.draft_mode === 'disabled') {
    return { ok: false as const, error: 'Email draft generation is disabled for this tenant' }
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
  const classification = classifyEmailMessage({
    subject: thread?.subject ?? null,
    senderEmail: message.from_email ?? thread?.sender_email ?? null,
    bodyText,
    messageMetadata: message.metadata,
    connectionMetadata: connection.metadata,
  })

  if (!classification.shouldProcess) {
    await admin
      .from('email_threads')
      .update({
        status: 'ignored',
        metadata: {
          source: 'email_classifier',
          classification,
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

  const provider = getEmailAgentProvider(connection.metadata)
  if (!provider.ok) return provider

  const result = await provider.provider.generateDraft({
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
    knowledgeHints: knowledgeMatches.slice(0, 5).map((match) => ({
      question: match.question,
      answer: match.answer,
      category: match.category,
      priority: match.priority,
    })),
  })

  if (!result.ok) {
    await admin
      .from('email_threads')
      .update({
        status: 'escalated',
        metadata: {
          email_agent_error: result.error,
          email_agent_details: result.details ?? null,
        },
      })
      .eq('id', message.thread_id)

    return result
  }

  const draft = result.draft
  if (!draft.shouldReply) {
    await admin
      .from('email_threads')
      .update({
        status: 'ignored',
        topic: draft.topic ?? 'otro',
        priority: draft.priority,
        metadata: buildDraftMetadata(draft, classification),
      })
      .eq('id', message.thread_id)

    return {
      ok: true as const,
      action: 'ignored' as const,
      threadId: message.thread_id,
    }
  }

  const draftMetadata = buildDraftMetadata(draft, classification)
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
        topic: draft.topic ?? 'otro',
        priority: draft.priority,
        metadata: {
          source: 'email_agent',
          classification: {
            ...classification,
            agent_reason: draft.classificationReason,
          },
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

async function getFreshGoogleAccessToken(
  admin: AdminClient,
  connection: {
    id: string
    oauth_metadata: Json
  },
) {
  const oauthMetadata = getJsonRecord(connection.oauth_metadata)
  const tokens = decryptOAuthTokens(oauthMetadata.encrypted_tokens)

  if (!tokens.refresh_token) {
    return tokens.access_token
  }

  const refreshedTokens = await refreshGoogleAccessToken(tokens.refresh_token)
  const mergedTokens = {
    ...tokens,
    ...refreshedTokens,
    refresh_token: refreshedTokens.refresh_token ?? tokens.refresh_token,
  }
  const expiresAt = refreshedTokens.expires_in
    ? new Date(Date.now() + refreshedTokens.expires_in * 1000).toISOString()
    : typeof oauthMetadata.expires_at === 'string'
      ? oauthMetadata.expires_at
      : null

  await admin
    .from('email_connections')
    .update({
      oauth_metadata: {
        ...oauthMetadata,
        encrypted_tokens: encryptOAuthTokens(mergedTokens),
        expires_at: expiresAt,
        token_type: mergedTokens.token_type ?? null,
        last_refreshed_at: new Date().toISOString(),
      } satisfies Json,
      status: 'connected',
      error_message: null,
    })
    .eq('id', connection.id)

  return mergedTokens.access_token
}

function getEmailAgentProvider(metadata: Json) {
  const metadataRecord = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, Json | undefined>
    : {}
  const webhookFromMetadata = typeof metadataRecord.n8n_email_agent_webhook_url === 'string'
    ? metadataRecord.n8n_email_agent_webhook_url
    : null
  const webhookUrl = webhookFromMetadata ?? process.env.DEFAULT_N8N_EMAIL_AGENT_WEBHOOK_URL

  if (!webhookUrl) {
    return {
      ok: false as const,
      error: 'Email agent webhook is not configured',
    }
  }

  return {
    ok: true as const,
    provider: new N8nEmailAgentProvider(webhookUrl) satisfies EmailAgentProvider,
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
}, classification?: ReturnType<typeof classifyEmailMessage>) {
  return {
    source: 'email_agent',
    provider: 'n8n',
    confidence: draft.confidence,
    escalation_reason: draft.escalationReason,
    classification: classification
      ? {
        ...classification,
        agent_reason: draft.classificationReason,
      }
      : null,
    raw_response: (draft.raw ?? null) as Json,
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
