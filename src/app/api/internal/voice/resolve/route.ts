import { authorizeInternalApiRequest } from '@/lib/auth/internal-api'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantVoiceConfig } from '@/lib/tenants/service'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const authorization = authorizeInternalApiRequest(request.headers.get('x-talia-internal-key'))
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status })
  }

  const phone = request.nextUrl.searchParams.get('phone')
  if (!phone) {
    return NextResponse.json({ error: 'Missing phone parameter' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('theatres')
    .select('id')
    .eq('voice_phone_number', phone)
    .eq('voice_enabled', true)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No active voice agent for this number' }, { status: 404 })
  }

  const result = await getTenantVoiceConfig(admin, data.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }

  const { config } = result
  return NextResponse.json({
    tenant_id: config.tenantId,
    voice_id: config.voiceId,
    voice_language: config.voiceLanguage,
    voice_system_prompt: config.voiceSystemPrompt,
    voice_max_turns: config.voiceMaxTurns,
    fallback_email: config.fallbackEmail,
    fallback_phone: config.fallbackPhone,
    knowledge_items: config.knowledgeItems,
  })
}
