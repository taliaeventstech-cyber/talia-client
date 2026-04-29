import { sendChatMessageToN8n } from '@/lib/chat/n8n'
import { corsJson, corsNoContent } from '@/lib/http/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantChatConfig } from '@/lib/tenants/service'

type ChatPayload = {
  session_id?: string
  sessionId?: string
  message?: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const payload = await request.json() as ChatPayload
  const sessionId = payload.session_id ?? payload.sessionId
  const message = payload.message?.trim()

  if (!sessionId || !message) {
    return corsJson({ error: 'session_id and message are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const tenant = await getTenantChatConfig(admin, tenantId)

  if (!tenant.ok) {
    return corsJson({ error: tenant.error }, { status: 404 })
  }

  if (!tenant.config.n8nWebhookUrl) {
    return corsJson({ error: 'Chat is not configured for this tenant' }, { status: 503 })
  }

  const response = await sendChatMessageToN8n({
    webhookUrl: tenant.config.n8nWebhookUrl,
    tenantId,
    sessionId,
    message,
  })

  if (!response.ok) {
    return corsJson({ error: response.error, details: response.details }, { status: 502 })
  }

  return corsJson({
    reply: response.reply,
    session_id: sessionId,
  })
}

export function OPTIONS() {
  return corsNoContent()
}
