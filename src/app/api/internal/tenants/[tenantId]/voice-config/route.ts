import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantVoiceConfig } from '@/lib/tenants/service'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const internalKey = process.env.INTERNAL_API_KEY
  const providedKey = request.headers.get('x-talia-internal-key')

  if (internalKey && providedKey !== internalKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tenantId } = await params
  const admin = createAdminClient()
  const result = await getTenantVoiceConfig(admin, tenantId)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  const { config } = result

  if (!config.voiceEnabled) {
    return NextResponse.json({ error: 'Voice agent not enabled for this tenant' }, { status: 403 })
  }

  return NextResponse.json({
    tenant_id: config.tenantId,
    name: config.name,
    voice_id: config.voiceId,
    voice_language: config.voiceLanguage,
    voice_system_prompt: config.voiceSystemPrompt,
    voice_max_turns: config.voiceMaxTurns,
    fallback_email: config.fallbackEmail,
    fallback_phone: config.fallbackPhone,
    knowledge_items: config.knowledgeItems,
  })
}
