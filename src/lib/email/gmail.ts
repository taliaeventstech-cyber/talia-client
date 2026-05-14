import crypto from 'node:crypto'

const GMAIL_DRAFTS_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/drafts'
const GMAIL_MESSAGES_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages'

export type GmailMessageListItem = {
  id: string
  threadId?: string
}

export type GmailMessageListResponse = {
  messages?: GmailMessageListItem[]
  nextPageToken?: string
  resultSizeEstimate?: number
}

export type GmailMessagePart = {
  partId?: string
  mimeType?: string
  filename?: string
  headers?: Array<{ name: string; value: string }>
  body?: {
    attachmentId?: string
    data?: string
    size?: number
  }
  parts?: GmailMessagePart[]
}

export type GmailMessageResponse = {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  historyId?: string
  internalDate?: string
  payload?: GmailMessagePart
  sizeEstimate?: number
}

export type ParsedGmailMessage = {
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

export type CreateGmailDraftInput = {
  to: string
  subject: string
  bodyText: string
  bodyHtml?: string | null
}

export type GmailDraftResponse = {
  id: string
  message?: {
    id?: string
    threadId?: string
  }
}

export async function createGmailDraft(accessToken: string, input: CreateGmailDraftInput) {
  const response = await fetch(GMAIL_DRAFTS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        raw: encodeBase64Url(buildMimeMessage(input)),
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Gmail draft creation failed: ${await response.text()}`)
  }

  return response.json() as Promise<GmailDraftResponse>
}

export async function listGmailInboxMessages(
  accessToken: string,
  input: { maxResults?: number; query?: string } = {},
) {
  const url = new URL(GMAIL_MESSAGES_ENDPOINT)
  url.searchParams.set('maxResults', String(input.maxResults ?? 10))
  url.searchParams.set('q', input.query ?? 'in:inbox newer_than:14d')

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Gmail message list failed: ${await response.text()}`)
  }

  return response.json() as Promise<GmailMessageListResponse>
}

export async function getGmailMessage(accessToken: string, messageId: string) {
  const url = new URL(`${GMAIL_MESSAGES_ENDPOINT}/${encodeURIComponent(messageId)}`)
  url.searchParams.set('format', 'full')

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Gmail message get failed: ${await response.text()}`)
  }

  return response.json() as Promise<GmailMessageResponse>
}

export function parseGmailMessage(message: GmailMessageResponse): ParsedGmailMessage {
  const headers = extractHeaders(message.payload)
  const from = parseEmailAddress(headers.from ?? '')
  const body = extractBody(message.payload)

  return {
    id: message.id,
    threadId: message.threadId,
    subject: headers.subject ?? null,
    fromEmail: from.email,
    fromName: from.name,
    toEmails: parseEmailAddressList(headers.to ?? ''),
    ccEmails: parseEmailAddressList(headers.cc ?? ''),
    bodyText: body.text,
    bodyHtml: body.html,
    receivedAt: parseReceivedAt(message.internalDate, headers.date),
    headers,
    labelIds: message.labelIds ?? [],
    snippet: message.snippet ?? null,
  }
}

function buildMimeMessage(input: CreateGmailDraftInput) {
  const headers = [
    ['To', input.to],
    ['Subject', input.subject],
    ['MIME-Version', '1.0'],
  ] satisfies Array<[string, string]>

  if (!input.bodyHtml) {
    return [
      ...headers.map(([name, value]) => `${name}: ${sanitizeHeaderValue(value)}`),
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      input.bodyText,
    ].join('\r\n')
  }

  const boundary = `talia_${crypto.randomUUID().replaceAll('-', '')}`

  return [
    ...headers.map(([name, value]) => `${name}: ${sanitizeHeaderValue(value)}`),
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    input.bodyText,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    input.bodyHtml,
    '',
    `--${boundary}--`,
  ].join('\r\n')
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function sanitizeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function extractHeaders(part: GmailMessagePart | undefined) {
  const headers: Record<string, string> = {}
  for (const header of part?.headers ?? []) {
    headers[header.name.toLowerCase()] = header.value
  }
  return headers
}

function extractBody(part: GmailMessagePart | undefined): { text: string | null; html: string | null } {
  if (!part) return { text: null, html: null }

  const textParts: string[] = []
  const htmlParts: string[] = []
  collectBodyParts(part, textParts, htmlParts)

  return {
    text: textParts.join('\n\n').trim() || null,
    html: htmlParts.join('\n\n').trim() || null,
  }
}

function collectBodyParts(part: GmailMessagePart, textParts: string[], htmlParts: string[]) {
  const decoded = part.body?.data ? decodeBase64Url(part.body.data).trim() : ''

  if (decoded && part.mimeType === 'text/plain') {
    textParts.push(decoded)
  }

  if (decoded && part.mimeType === 'text/html') {
    htmlParts.push(decoded)
  }

  for (const child of part.parts ?? []) {
    collectBodyParts(child, textParts, htmlParts)
  }
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function parseEmailAddressList(value: string) {
  if (!value) return []
  return value
    .split(',')
    .map((item) => parseEmailAddress(item).email)
    .filter((email): email is string => Boolean(email))
}

function parseEmailAddress(value: string) {
  const angleMatch = value.match(/^(.*)<([^>]+)>$/)
  if (angleMatch) {
    return {
      name: cleanHeaderName(angleMatch[1]),
      email: angleMatch[2].trim().toLowerCase(),
    }
  }

  const trimmed = value.trim()
  return {
    name: null,
    email: trimmed.includes('@') ? trimmed.toLowerCase() : null,
  }
}

function cleanHeaderName(value: string) {
  const cleaned = value.trim().replace(/^"|"$/g, '')
  return cleaned || null
}

function parseReceivedAt(internalDate: string | undefined, headerDate: string | undefined) {
  if (internalDate && /^\d+$/.test(internalDate)) {
    return new Date(Number(internalDate)).toISOString()
  }

  if (headerDate) {
    const date = new Date(headerDate)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }

  return null
}
