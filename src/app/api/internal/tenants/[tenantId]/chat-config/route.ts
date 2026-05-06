import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantRuntimeChatConfig } from '@/lib/tenants/service'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const internalKey = process.env.INTERNAL_API_KEY
  const providedKey = request.headers.get('x-talia-internal-key')

  if (!internalKey && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Internal API key not configured' }, { status: 503 })
  }

  if (internalKey && providedKey !== internalKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    scrape_urls: result.config.scrapeUrls,
    topic_categories: result.config.topicCategories,
    knowledge_items: result.config.knowledgeItems,
  })
}
