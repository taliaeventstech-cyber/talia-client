'use server'

import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { consumeRateLimit } from '@/lib/auth/security'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin } from '@/lib/tenants/service'
import { getAgentVoicePreviewSample, isAgentVoice } from '@/lib/widget/agent-voices'
import { createSpeechProviderFromEnv } from '@/lib/widget/talia-ai-speech-provider'
import { recordVoiceUsage } from '@/lib/widget/voice-request-guard'

export type AgentVoicePreviewResult =
  | { ok: true; audioBase64: string }
  | { ok: false; error: 'forbidden' | 'invalid_voice' | 'rate_limited' | 'unavailable' }

/**
 * Plays a short sample of a Web Agent voice in Agora settings. Only venue
 * admins can call it; it is rate limited per user and recorded as usage
 * like any other voice call.
 */
export async function previewAgentVoice(tenantId: string, voice: string): Promise<AgentVoicePreviewResult> {
  await requireTenantProductAccess(tenantId, 'manage_chatbot', 'web')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'forbidden' }

  const admin = createAdminClient()
  if (!await assertTenantAdmin(admin, user.id, tenantId)) {
    return { ok: false, error: 'forbidden' }
  }

  if (!isAgentVoice(voice)) return { ok: false, error: 'invalid_voice' }

  const limited = await consumeRateLimit([{
    key: `voice-preview:${tenantId}:${user.id}`,
    limit: 20,
    windowMs: 10 * 60_000,
  }])
  if (limited) return { ok: false, error: limited.unavailable ? 'unavailable' : 'rate_limited' }

  const provider = createSpeechProviderFromEnv()
  if (!provider) return { ok: false, error: 'unavailable' }

  const { data: theatre } = await admin
    .from('theatres')
    .select('primary_language')
    .eq('id', tenantId)
    .single()
  const sample = getAgentVoicePreviewSample(theatre?.primary_language)
  const sessionId = `agora-voice-preview:${user.id}`

  const result = await provider.synthesize({
    tenantId,
    sessionId,
    text: sample.text,
    language: sample.language,
    pace: 'normal',
    voice,
  })

  if (!result.ok) {
    console.warn('[voice] Agora voice preview failed', { tenantId, error: result.error })
    return { ok: false, error: 'unavailable' }
  }

  await recordVoiceUsage(admin, {
    tenantId,
    sessionId,
    components: result.usageComponents,
    metadata: {
      characters: sample.text.length,
      voice,
      source: 'agora_voice_preview',
    },
  })

  return { ok: true, audioBase64: Buffer.from(result.audio).toString('base64') }
}
