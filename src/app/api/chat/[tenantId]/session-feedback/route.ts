import { corsJson, corsNoContent } from '@/lib/http/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantChatConfig } from '@/lib/tenants/service'
import { getTenantWidgetDomainSettings, validateWidgetRequestDomain } from '@/lib/widget/domain-allowlist'
import type { Json } from '@/types/database.types'

type ChatSessionFeedbackPayload = {
  session_id?: string
  sessionId?: string
  resolved?: boolean
  skipped?: boolean
  comments?: string
  page_url?: string
  pageUrl?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const payload = await request.json() as ChatSessionFeedbackPayload
  const sessionId = payload.session_id ?? payload.sessionId
  const pageUrl = normalizePageUrl(payload.page_url ?? payload.pageUrl)
  const comments = normalizeComments(payload.comments)
  const skipped = payload.skipped === true
  const resolved = typeof payload.resolved === 'boolean' ? payload.resolved : null

  if (!sessionId || (!skipped && resolved === null)) {
    return corsJson({ error: 'session_id and feedback result are required' }, { status: 400 })
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

  const { data: conversation, error: conversationError } = await admin
    .from('conversations')
    .select('id, metadata')
    .eq('theatre_id', tenantId)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (conversationError) {
    return corsJson({ error: 'Failed to load conversation', details: conversationError.message }, { status: 500 })
  }

  if (!conversation) {
    return corsJson({ ok: true, skipped: true, reason: 'conversation_not_found' })
  }

  const metadata = mergeSessionFeedbackMetadata(conversation.metadata, {
    resolved,
    skipped,
    comments,
  })
  const { error: updateError } = await admin
    .from('conversations')
    .update({ metadata })
    .eq('id', conversation.id)
    .eq('theatre_id', tenantId)

  if (updateError) {
    return corsJson({ error: 'Failed to save session feedback', details: updateError.message }, { status: 500 })
  }

  return corsJson({ ok: true })
}

export function OPTIONS() {
  return corsNoContent()
}

function mergeSessionFeedbackMetadata(
  metadata: Json | null,
  feedback: { resolved: boolean | null; skipped: boolean; comments: string | null }
) {
  const base = isRecord(metadata) ? metadata : {}
  return {
    ...base,
    session_feedback: {
      resolved: feedback.skipped ? null : feedback.resolved,
      skipped: feedback.skipped,
      comments: feedback.comments,
      submitted_at: new Date().toISOString(),
    },
  } satisfies Record<string, Json>
}

function normalizeComments(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 1000) : null
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
