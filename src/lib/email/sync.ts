import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database.types'
import { getFreshGoogleAccessToken } from './google-tokens'
import {
  getGmailMessage,
  listGmailInboxMessages,
  parseGmailMessage,
  type ParsedGmailMessage,
} from './gmail'
import { getFreshMicrosoftAccessToken } from './microsoft-tokens'
import {
  getOutlookMessage,
  listOutlookInboxMessages,
  parseOutlookMessage,
  type ParsedOutlookMessage,
} from './outlook'

type AdminClient = ReturnType<typeof createAdminClient>
const GMAIL_LIST_PAGE_SIZE = 50
const GMAIL_MAX_INSPECTED_PER_SYNC = 500
const DEFAULT_GMAIL_SYNC_LIMIT = 100

export type SyncGmailInput = {
  tenantId: string
  maxResults?: number
  query?: string
}

export async function syncGmailMessages(admin: AdminClient, input: SyncGmailInput) {
  const { data: connection } = await admin
    .from('email_connections')
    .select('id, theatre_id, provider, mailbox_email, status, oauth_metadata, metadata')
    .eq('theatre_id', input.tenantId)
    .in('provider', ['google', 'microsoft'])
    .in('status', ['connected', 'syncing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!connection) {
    return { ok: false as const, error: 'No connected email mailbox for this tenant' }
  }

  await admin
    .from('email_connections')
    .update({ status: 'syncing', error_message: null })
    .eq('id', connection.id)

  try {
    const syncConfig = getEmailSyncConfig(connection.metadata)
    const accessToken = connection.provider === 'microsoft'
      ? await getFreshMicrosoftAccessToken(admin, {
        id: connection.id,
        oauth_metadata: connection.oauth_metadata,
      })
      : await getFreshGoogleAccessToken(admin, {
        id: connection.id,
        oauth_metadata: connection.oauth_metadata,
      })
    const messageRefs = connection.provider === 'microsoft'
      ? await listOutlookMessagesForSync(accessToken, {
        windowDays: syncConfig.windowDays,
        maxMessages: input.maxResults ?? syncConfig.limit,
      })
      : await listGmailMessagesForSync(accessToken, {
        query: input.query ?? syncConfig.query,
        maxMessages: input.maxResults ?? syncConfig.limit,
      })
    const newestMessageId = messageRefs[0]?.id ?? null
    const existingMessageIds = await getExistingProviderMessageIds(
      admin,
      connection.id,
      messageRefs.map((messageRef) => messageRef.id),
    )
    let imported = 0
    let skipped = 0

    for (const messageRef of messageRefs.reverse()) {
      if (existingMessageIds.has(messageRef.id)) {
        skipped += 1
        continue
      }

      const parsed = connection.provider === 'microsoft'
        ? parseOutlookMessage(await getOutlookMessage(accessToken, messageRef.id))
        : parseGmailMessage(await getGmailMessage(accessToken, messageRef.id))

      const result = await persistProviderMessage(admin, {
        tenantId: input.tenantId,
        connectionId: connection.id,
        mailboxEmail: connection.mailbox_email,
        provider: connection.provider,
        message: parsed,
      })

      if (result.imported) imported += 1
      else skipped += 1
    }

    await admin
      .from('email_connections')
      .update({
        status: 'connected',
        sync_cursor: newestMessageId,
        last_synced_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', connection.id)

    return {
      ok: true as const,
      imported,
      skipped,
      inspected: messageRefs.length,
      connectionId: connection.id,
      autoProcessAfterSync: syncConfig.autoProcessAfterSync,
      autoClassifyAfterSync: syncConfig.autoClassifyAfterSync,
      autoDraftAfterSync: syncConfig.autoDraftAfterSync,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await admin
      .from('email_connections')
      .update({
        status: 'error',
        error_message: message.slice(0, 500),
      })
      .eq('id', connection.id)

    return { ok: false as const, error: 'Failed to sync email messages', details: message }
  }
}

async function listGmailMessagesForSync(
  accessToken: string,
  input: { query: string; maxMessages: number },
) {
  const messages: Array<{ id: string; threadId?: string }> = []
  let pageToken: string | undefined

  do {
    const remaining = Math.min(input.maxMessages, GMAIL_MAX_INSPECTED_PER_SYNC) - messages.length
    if (remaining <= 0) break

    const listed = await listGmailInboxMessages(accessToken, {
      maxResults: Math.min(GMAIL_LIST_PAGE_SIZE, remaining),
      query: input.query,
      pageToken,
    })

    messages.push(...(listed.messages ?? []))
    pageToken = listed.nextPageToken
  } while (pageToken)

  return messages
}

async function listOutlookMessagesForSync(
  accessToken: string,
  input: { windowDays: number; maxMessages: number },
) {
  const messages: Array<{ id: string; threadId?: string }> = []
  let nextLink: string | undefined
  const since = new Date(Date.now() - input.windowDays * 24 * 60 * 60 * 1000)

  do {
    const remaining = Math.min(input.maxMessages, GMAIL_MAX_INSPECTED_PER_SYNC) - messages.length
    if (remaining <= 0) break

    const listed = await listOutlookInboxMessages(accessToken, {
      maxResults: remaining,
      since,
      nextLink,
    })

    messages.push(...(listed.value ?? []).map((message) => ({
      id: message.id,
      threadId: message.conversationId,
    })))
    nextLink = listed['@odata.nextLink']
  } while (nextLink)

  return messages
}

export function getEmailSyncConfig(metadata: Json) {
  const record = getJsonRecord(metadata)
  const configuredWindow = typeof record.gmail_sync_window_days === 'number'
    ? record.gmail_sync_window_days
    : 14
  const windowDays = [1, 7, 14, 30].includes(configuredWindow) ? configuredWindow : 14
  const configuredLimit = typeof record.gmail_sync_limit === 'number'
    ? record.gmail_sync_limit
    : DEFAULT_GMAIL_SYNC_LIMIT
  const limit = [10, 25, 50, 100, 250, 500].includes(configuredLimit)
    ? configuredLimit
    : DEFAULT_GMAIL_SYNC_LIMIT
  const configuredQuery = typeof record.gmail_sync_query === 'string'
    ? record.gmail_sync_query.trim()
    : ''

  return {
    windowDays,
    limit,
    query: configuredQuery || `in:inbox newer_than:${windowDays}d`,
    autoProcessAfterSync: record.auto_process_after_sync === true,
    autoClassifyAfterSync: typeof record.auto_classify_after_sync === 'boolean'
      ? record.auto_classify_after_sync
      : record.auto_process_after_sync === true,
    autoDraftAfterSync: typeof record.auto_draft_after_sync === 'boolean'
      ? record.auto_draft_after_sync
      : record.auto_process_after_sync === true,
  }
}

async function getExistingProviderMessageIds(
  admin: AdminClient,
  connectionId: string,
  messageIds: string[],
) {
  if (messageIds.length === 0) return new Set<string>()

  const { data, error } = await admin
    .from('email_messages')
    .select('provider_message_id')
    .eq('connection_id', connectionId)
    .in('provider_message_id', messageIds)

  if (error) throw error

  return new Set((data ?? []).map((message) => message.provider_message_id))
}

async function persistProviderMessage(
  admin: AdminClient,
  input: {
    tenantId: string
    connectionId: string
    mailboxEmail: string
    provider: string
    message: ParsedGmailMessage | ParsedOutlookMessage
  },
) {
  const { data: existingMessage, error: existingMessageError } = await admin
    .from('email_messages')
    .select('id')
    .eq('connection_id', input.connectionId)
    .eq('provider_message_id', input.message.id)
    .maybeSingle()

  if (existingMessageError) throw existingMessageError
  if (existingMessage) return { imported: false }

  const thread = await upsertProviderThread(admin, input)
  const direction = input.message.fromEmail === input.mailboxEmail.toLowerCase()
    ? 'outbound'
    : 'inbound'

  const { error: insertError } = await admin
    .from('email_messages')
    .insert({
      theatre_id: input.tenantId,
      connection_id: input.connectionId,
      thread_id: thread.id,
      provider_message_id: input.message.id,
      direction,
      from_email: input.message.fromEmail,
      from_name: input.message.fromName,
      to_emails: input.message.toEmails,
      cc_emails: input.message.ccEmails,
      body_text: input.message.bodyText,
      body_html: input.message.bodyHtml,
      received_at: direction === 'inbound' ? input.message.receivedAt : null,
      sent_at: direction === 'outbound' ? input.message.receivedAt : null,
      metadata: {
        source: input.provider === 'microsoft' ? 'outlook_sync' : 'gmail_sync',
        provider: input.provider,
        provider_labels: input.message.labelIds,
        provider_snippet: input.message.snippet,
        provider_headers: input.message.headers,
        gmail_labels: input.provider === 'google' ? input.message.labelIds : undefined,
        gmail_snippet: input.provider === 'google' ? input.message.snippet : undefined,
        gmail_headers: input.provider === 'google' ? input.message.headers : undefined,
      } satisfies Json,
    })

  if (insertError) throw insertError
  return { imported: true }
}

async function upsertProviderThread(
  admin: AdminClient,
  input: {
    tenantId: string
    connectionId: string
    mailboxEmail: string
    provider: string
    message: ParsedGmailMessage | ParsedOutlookMessage
  },
) {
  const { data: existingThread, error: existingThreadError } = await admin
    .from('email_threads')
    .select('id, status')
    .eq('connection_id', input.connectionId)
    .eq('provider_thread_id', input.message.threadId)
    .maybeSingle()

  if (existingThreadError) throw existingThreadError

  const isInbound = input.message.fromEmail !== input.mailboxEmail.toLowerCase()
  const threadPayload = {
    subject: input.message.subject,
    sender_email: isInbound ? input.message.fromEmail : null,
    sender_name: isInbound ? input.message.fromName : null,
    last_message_at: input.message.receivedAt,
    metadata: {
      source: input.provider === 'microsoft' ? 'outlook_sync' : 'gmail_sync',
      provider: input.provider,
      latest_provider_message_id: input.message.id,
      latest_gmail_message_id: input.provider === 'google' ? input.message.id : undefined,
    } satisfies Json,
  }

  if (existingThread) {
    const shouldMarkNew = isInbound && existingThread.status !== 'new'
    const { error: updateError } = await admin
      .from('email_threads')
      .update({
        ...threadPayload,
        status: shouldMarkNew ? 'new' : existingThread.status,
      })
      .eq('id', existingThread.id)

    if (updateError) throw updateError
    return existingThread
  }

  const { data: createdThread, error: insertError } = await admin
    .from('email_threads')
    .insert({
      theatre_id: input.tenantId,
      connection_id: input.connectionId,
      provider_thread_id: input.message.threadId,
      status: isInbound ? 'new' : 'resolved',
      ...threadPayload,
    })
    .select('id, status')
    .single()

  if (insertError || !createdThread) throw insertError ?? new Error('Failed to create email thread')
  return createdThread
}

function getJsonRecord(value: Json) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {}
}
