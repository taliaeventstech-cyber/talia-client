const GRAPH_MESSAGES_ENDPOINT = 'https://graph.microsoft.com/v1.0/me/messages'
const GRAPH_INBOX_MESSAGES_ENDPOINT = 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages'

export type OutlookMessageListItem = {
  id: string
  conversationId?: string
}

export type OutlookMessageListResponse = {
  value?: OutlookMessageListItem[]
  '@odata.nextLink'?: string
}

export type OutlookEmailAddress = {
  emailAddress?: {
    name?: string | null
    address?: string | null
  } | null
}

export type OutlookMessageResponse = {
  id: string
  conversationId?: string
  subject?: string | null
  from?: OutlookEmailAddress | null
  toRecipients?: OutlookEmailAddress[]
  ccRecipients?: OutlookEmailAddress[]
  body?: {
    contentType?: 'text' | 'html'
    content?: string | null
  } | null
  bodyPreview?: string | null
  receivedDateTime?: string | null
  sentDateTime?: string | null
  internetMessageHeaders?: Array<{ name?: string; value?: string }>
}

export type ParsedOutlookMessage = {
  id: string
  threadId: string
  subject: string | null
  fromEmail: string | null
  fromName: string | null
  toEmails: string[]
  ccEmails: string[]
  bodyText: string | null
  bodyHtml: string | null
  receivedAt: string | null
  headers: Record<string, string>
  labelIds: string[]
  snippet: string | null
}

export type CreateOutlookDraftInput = {
  to: string
  subject: string
  bodyText: string
  bodyHtml?: string | null
}

export type OutlookDraftResponse = {
  id: string
  conversationId?: string
}

export async function createOutlookDraft(accessToken: string, input: CreateOutlookDraftInput) {
  const response = await fetch(GRAPH_MESSAGES_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: input.subject,
      body: {
        contentType: input.bodyHtml ? 'HTML' : 'Text',
        content: input.bodyHtml ?? input.bodyText,
      },
      toRecipients: [
        {
          emailAddress: {
            address: input.to,
          },
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Outlook draft creation failed: ${await response.text()}`)
  }

  return response.json() as Promise<OutlookDraftResponse>
}

export async function deleteOutlookDraft(accessToken: string, draftId: string) {
  const response = await fetch(`${GRAPH_MESSAGES_ENDPOINT}/${encodeURIComponent(draftId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Outlook draft deletion failed: ${await response.text()}`)
  }
}

export async function listOutlookInboxMessages(
  accessToken: string,
  input: { maxResults?: number; since?: Date; nextLink?: string } = {},
) {
  const url = input.nextLink ? new URL(input.nextLink) : new URL(GRAPH_INBOX_MESSAGES_ENDPOINT)

  if (!input.nextLink) {
    url.searchParams.set('$top', String(Math.min(input.maxResults ?? 10, 50)))
    url.searchParams.set('$select', 'id,conversationId,receivedDateTime')
    url.searchParams.set('$orderby', 'receivedDateTime desc')
    if (input.since) {
      url.searchParams.set('$filter', `receivedDateTime ge ${input.since.toISOString()}`)
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.body-content-type="text"',
    },
  })

  if (!response.ok) {
    throw new Error(`Outlook message list failed: ${await response.text()}`)
  }

  return response.json() as Promise<OutlookMessageListResponse>
}

export async function getOutlookMessage(accessToken: string, messageId: string) {
  const url = new URL(`${GRAPH_MESSAGES_ENDPOINT}/${encodeURIComponent(messageId)}`)
  url.searchParams.set(
    '$select',
    'id,conversationId,subject,from,toRecipients,ccRecipients,body,bodyPreview,receivedDateTime,sentDateTime,internetMessageHeaders',
  )

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.body-content-type="text"',
    },
  })

  if (!response.ok) {
    throw new Error(`Outlook message get failed: ${await response.text()}`)
  }

  return response.json() as Promise<OutlookMessageResponse>
}

export function parseOutlookMessage(message: OutlookMessageResponse): ParsedOutlookMessage {
  const from = message.from?.emailAddress
  const bodyContent = message.body?.content?.trim() || null
  const bodyHtml = message.body?.contentType?.toLowerCase() === 'html' ? bodyContent : null
  const bodyText = message.body?.contentType?.toLowerCase() === 'html'
    ? stripHtml(bodyContent)
    : bodyContent

  return {
    id: message.id,
    threadId: message.conversationId ?? message.id,
    subject: message.subject ?? null,
    fromEmail: from?.address?.toLowerCase() ?? null,
    fromName: from?.name ?? null,
    toEmails: parseRecipients(message.toRecipients),
    ccEmails: parseRecipients(message.ccRecipients),
    bodyText: bodyText || message.bodyPreview || null,
    bodyHtml,
    receivedAt: message.receivedDateTime ?? message.sentDateTime ?? null,
    headers: extractHeaders(message.internetMessageHeaders),
    labelIds: [],
    snippet: message.bodyPreview ?? null,
  }
}

function parseRecipients(recipients: OutlookEmailAddress[] | undefined) {
  return (recipients ?? [])
    .map((recipient) => recipient.emailAddress?.address?.toLowerCase())
    .filter((email): email is string => Boolean(email))
}

function extractHeaders(headers: OutlookMessageResponse['internetMessageHeaders']) {
  const record: Record<string, string> = {}
  for (const header of headers ?? []) {
    if (header.name && header.value) record[header.name.toLowerCase()] = header.value
  }
  return record
}

function stripHtml(value: string | null) {
  if (!value) return null
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null
}
