import type { Json } from '@/types/database.types'

export type EmailClassification = {
  shouldProcess: boolean
  reason: string
  source: 'rules'
  confidence: number
}

export type ClassifyEmailInput = {
  subject: string | null
  senderEmail: string | null
  bodyText: string
  messageMetadata: Json
  connectionMetadata: Json
}

export function classifyEmailMessage(input: ClassifyEmailInput): EmailClassification {
  const config = getClassifierConfig(input.connectionMetadata)
  const senderEmail = input.senderEmail?.trim().toLowerCase() ?? ''
  const senderDomain = senderEmail.includes('@') ? senderEmail.split('@').pop() ?? '' : ''

  if (config.blockedSenders.includes(senderEmail)) {
    return ignore('blocked_sender', 1)
  }

  if (senderDomain && config.blockedDomains.includes(senderDomain)) {
    return ignore('blocked_domain', 1)
  }

  if (config.excludeAutomated && isAutomatedMessage(input, senderEmail)) {
    return ignore('automated_message', 0.95)
  }

  return {
    shouldProcess: true,
    reason: 'candidate_for_agent',
    source: 'rules',
    confidence: 0.7,
  }
}

function getClassifierConfig(metadata: Json) {
  const record = getJsonRecord(metadata)

  return {
    excludeAutomated: record.exclude_automated !== false,
    blockedSenders: getStringList(record.blocked_senders),
    blockedDomains: getStringList(record.blocked_domains),
  }
}

function isAutomatedMessage(input: ClassifyEmailInput, senderEmail: string) {
  const headers = getJsonRecord(getJsonRecord(input.messageMetadata).gmail_headers)
  const fullText = `${input.subject ?? ''}\n${input.bodyText}`.toLowerCase()

  if (/^(no[-_. ]?reply|noreply|mailer-daemon|postmaster)@/i.test(senderEmail)) return true
  if (getHeader(headers, 'auto-submitted') && getHeader(headers, 'auto-submitted') !== 'no') return true
  if (getHeader(headers, 'list-unsubscribe')) return true
  if (['bulk', 'junk', 'list'].includes(getHeader(headers, 'precedence') ?? '')) return true

  const nonActionablePattern = /(newsletter|unsubscribe|delivery status notification|undelivered mail|out of office|fuera de la oficina|resposta autom[aà]tica|respuesta autom[aá]tica)/i
  const actionablePattern = /(\?|horari|horarios|opening hours|entrad|ticket|precio|preu|price|descompte|descuento|discount|grupo|grup|group|accessibil|ubicaci|direcci|programaci|cartelera|agenda|visita|contact|devoluci|refund|voldria|queria|quisiera|can you|could you|hi ha|hay|teniu|ten[eé]is)/i

  return nonActionablePattern.test(fullText) && !actionablePattern.test(fullText)
}

function ignore(reason: string, confidence: number): EmailClassification {
  return {
    shouldProcess: false,
    reason,
    source: 'rules',
    confidence,
  }
}

function getHeader(headers: Record<string, Json | undefined>, name: string) {
  const value = headers[name]
  return typeof value === 'string' ? value.trim().toLowerCase() : null
}

function getJsonRecord(value: Json | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {}
}

function getStringList(value: Json | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.toLowerCase())
    : []
}
