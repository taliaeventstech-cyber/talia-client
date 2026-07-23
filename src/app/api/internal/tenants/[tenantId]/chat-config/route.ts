import { authorizeInternalApiRequest } from '@/lib/auth/internal-api'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const result = await getTenantRuntimeChatConfig(admin, tenantId)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  return NextResponse.json({
    tenant_id: result.config.tenantId,
    name: result.config.name,
    assistant_name: result.config.assistantName,
    primary_color: result.config.primaryColor,
    system_prompt: result.config.systemPrompt,
    fallback_email: result.config.fallbackEmail,
    fallback_phone: result.config.fallbackPhone,
    topic_categories: result.config.topicCategories,
    knowledge_items: result.config.knowledgeItems,
  })
}
