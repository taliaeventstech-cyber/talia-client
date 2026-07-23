import { authorizeInternalApiRequest } from '@/lib/auth/internal-api'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEmailAgentSettings } from '@/lib/email/settings'
import { getTenantRuntimeChatConfig } from '@/lib/tenants/service'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const authorization = authorizeInternalApiRequest(request.headers.get('x-talia-internal-key'))
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status })
  }

  const { tenantId } = await params
  const admin = createAdminClient()
  const [{ data: connection }, configResult] = await Promise.all([
    admin
      .from('email_connections')
      .select('id, provider, mailbox_email, status, sync_mode, draft_mode, metadata')
      .eq('theatre_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getTenantRuntimeChatConfig(admin, tenantId),
  ])

  if (!configResult.ok) {
    return NextResponse.json({ error: configResult.error }, { status: 404 })
  }

  return NextResponse.json({
    tenant_id: configResult.config.tenantId,
    name: configResult.config.name,
    system_prompt: configResult.config.systemPrompt,
    fallback_email: configResult.config.fallbackEmail,
    fallback_phone: configResult.config.fallbackPhone,
    topic_categories: configResult.config.topicCategories,
    knowledge_items: configResult.config.knowledgeItems,
    email_agent_settings: getEmailAgentSettings(connection?.metadata),
    connection,
  })
}
