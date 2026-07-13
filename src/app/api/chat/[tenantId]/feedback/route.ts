import { corsJson, corsNoContent } from '@/lib/http/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantChatConfig } from '@/lib/tenants/service'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'
import type { Json } from '@/types/database.types'

type ChatFeedbackPayload = {
  session_id?: string
  sessionId?: string
  message_id?: string
  messageId?: string
  rating?: string
  page_url?: string
  pageUrl?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const payload = await request.json() as ChatFeedbackPayload
  const sessionId = payload.session_id ?? payload.sessionId
  const messageId = payload.message_id ?? payload.messageId
  const rating = normalizeRating(payload.rating)
  const pageUrl = normalizePageUrl(payload.page_url ?? payload.pageUrl)

  if (!sessionId || !messageId || !rating) {
    return corsJson({ error: 'session_id, message_id and rating are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const tenant = await getTenantChatConfig(admin, tenantId)

  if (!tenant.ok) {
    return corsJson({ error: tenant.error }, { status: 404 })
  }

  const domainSettings = await getTenantWidgetDomainSettings(admin, tenantId)
  if (!domainSettings.ok) {
    return corsJson({ error: domainSettings.error }, { status: 404 })
  }

  const domain = validateWidgetRequestDomain({
    request,
    pageUrl,
    ...domainSettings.settings,
  })
  if (!domain.ok) {
    return corsJson({ error: domain.error }, { status: 403 })
  }

  const { data: message, error: messageError } = await admin
    .from('messages')
    .select('id, conversation_id, metadata')
    .eq('id', messageId)
    .eq('theatre_id', tenantId)
    .eq('role', 'assistant')
    .maybeSingle()

  if (messageError) {
    return corsJson({ error: 'Failed to load message feedback target', details: messageError.message }, { status: 500 })
  }

  if (!message) {
    return corsJson({ error: 'assistant message not found' }, { status: 404 })
  }

  const { data: conversation, error: conversationError } = await admin
    .from('conversations')
    .select('id')
    .eq('id', message.conversation_id)
    .eq('theatre_id', tenantId)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (conversationError) {
    return corsJson({ error: 'Failed to validate conversation', details: conversationError.message }, { status: 500 })
  }

  if (!conversation) {
    return corsJson({ error: 'conversation not found' }, { status: 404 })
  }

  const metadata = mergeFeedbackMetadata(message.metadata, rating)
  const { error: updateError } = await admin
    .from('messages')
    .update({ metadata })
    .eq('id', message.id)
    .eq('theatre_id', tenantId)

  if (updateError) {
    return corsJson({ error: 'Failed to save message feedback', details: updateError.message }, { status: 500 })
  }

  return corsJson({ ok: true, rating })
}

export function OPTIONS() {
  return corsNoContent()
}

function normalizeRating(value: unknown) {
  return value === 'positive' || value === 'negative' ? value : null
}

function mergeFeedbackMetadata(metadata: Json, rating: 'positive' | 'negative') {
  const base = isRecord(metadata) ? metadata : {}
  return {
    ...base,
    feedback: {
      ...(isRecord(base.feedback) ? base.feedback : {}),
      rating,
      submitted_at: new Date().toISOString(),
    },
  } satisfies Record<string, Json>
}

function isRecord(value: unknown): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizePageUrl(value: unknown) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    url.hash = ''
    for (const key of Array.from(url.searchParams.keys())) {
      if (key.startsWith('talia_')) url.searchParams.delete(key)
    }
    url.search = url.searchParams.toString()
    return url.toString()
  } catch {
    return undefined
  }
}
