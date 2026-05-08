'use server'

import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { assertTenantAdmin } from '@/lib/tenants/service'
import { buildVoicePrompt, type VoiceTone } from '@/lib/voice/prompt-builder'
import { syncAgentToElevenLabs } from '@/lib/voice/elevenlabs-sync'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

export type VoiceSettingsState = {
  ok: boolean
  message: string
}

const voiceSettingsSchema = z.object({
  voiceEnabled: z.boolean(),
  elevenLabsAgentId: z.string().trim().max(200).optional(),
  voiceId: z.string().trim().max(200).optional(),
  voiceLanguage: z.enum(['ca', 'es', 'en']),
  voiceTone: z.enum(['warm', 'professional', 'neutral']),
  voiceTemperature: z.coerce.number().int().min(0).max(100),
  voiceCustomPrompt: z.string().trim().max(6000).optional(),
  voiceMaxTurns: z.coerce.number().int().min(1).max(30),
})

export async function updateVoiceSettings(
  tenantId: string,
  _previousState: VoiceSettingsState,
  formData: FormData
): Promise<VoiceSettingsState> {
  await requireTenantPermission(tenantId, 'manage_voice', 'voice')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const isAdmin = await assertTenantAdmin(admin, user.id, tenantId)
  if (!isAdmin) return { ok: false, message: 'No tienes permisos para editar esta configuración.' }

  const parsed = voiceSettingsSchema.safeParse({
    voiceEnabled: formData.get('voice_enabled') === 'on',
    elevenLabsAgentId: String(formData.get('elevenlabs_agent_id') ?? '').trim() || undefined,
    voiceId: String(formData.get('voice_id') ?? '').trim() || undefined,
    voiceLanguage: formData.get('voice_language') || 'ca',
    voiceTone: formData.get('voice_tone') || 'warm',
    voiceTemperature: formData.get('voice_temperature') || 50,
    voiceCustomPrompt: String(formData.get('voice_custom_prompt') ?? '').trim() || undefined,
    voiceMaxTurns: formData.get('voice_max_turns') || 10,
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Configuración no válida.' }
  }

  const { data } = parsed

  // Fetch theatre name + knowledge items to build the prompt
  const [theatreRes, knowledgeRes] = await Promise.all([
    admin.from('theatres').select('name, fallback_email, fallback_phone').eq('id', tenantId).single(),
    admin
      .from('knowledge_items')
      .select('question, answer, category, priority, language')
      .eq('theatre_id', tenantId)
      .eq('active', true)
      .order('priority', { ascending: false })
      .limit(50),
  ])

  if (!theatreRes.data) {
    return { ok: false, message: 'No se encontró el teatro.' }
  }

  // The effective system prompt: custom override or auto-generated
  const effectivePrompt = data.voiceCustomPrompt || buildVoicePrompt({
    theatreName: theatreRes.data.name,
    tone: data.voiceTone as VoiceTone,
    language: data.voiceLanguage,
    knowledgeItems: (knowledgeRes.data ?? []).map((item) => ({
      question: item.question,
      answer: item.answer,
      category: item.category,
      priority: item.priority,
      language: item.language,
    })),
    fallbackEmail: theatreRes.data.fallback_email,
    fallbackPhone: theatreRes.data.fallback_phone,
  })

  const { error } = await admin
    .from('theatres')
    .update({
      voice_enabled: data.voiceEnabled,
      elevenlabs_agent_id: data.elevenLabsAgentId || null,
      voice_id: data.voiceId || null,
      voice_language: data.voiceLanguage,
      voice_tone: data.voiceTone,
      voice_temperature: data.voiceTemperature,
      voice_system_prompt: data.voiceCustomPrompt || null,
      voice_max_turns: data.voiceMaxTurns,
    })
    .eq('id', tenantId)

  if (error) return { ok: false, message: `No se pudo guardar: ${error.message}` }

  if (data.elevenLabsAgentId) {
    const syncResult = await syncAgentToElevenLabs(data.elevenLabsAgentId, {
      systemPrompt: effectivePrompt,
      voiceId: data.voiceId ?? null,
      language: data.voiceLanguage,
      temperature: data.voiceTemperature,
    })

    if (!syncResult.ok) {
      revalidatePath(`/${tenantId}/voice/settings`)
      return {
        ok: false,
        message: `La configuración se guardó en TALIA, pero no se pudo sincronizar con ElevenLabs: ${syncResult.error}`,
      }
    }
  }

  revalidatePath(`/${tenantId}/voice/settings`)
  return { ok: true, message: 'Configuración de voz guardada y sincronizada con ElevenLabs.' }
}

export async function regenerateVoicePrompt(tenantId: string): Promise<{ prompt: string }> {
  await requireTenantPermission(tenantId, 'manage_voice', 'voice')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const isAdmin = await assertTenantAdmin(admin, user.id, tenantId)
  if (!isAdmin) return { prompt: '' }

  const [theatreRes, knowledgeRes] = await Promise.all([
    admin
      .from('theatres')
      .select('name, fallback_email, fallback_phone, voice_tone, voice_language')
      .eq('id', tenantId)
      .single(),
    admin
      .from('knowledge_items')
      .select('question, answer, category, priority, language')
      .eq('theatre_id', tenantId)
      .eq('active', true)
      .order('priority', { ascending: false })
      .limit(50),
  ])

  if (!theatreRes.data) return { prompt: '' }

  const prompt = buildVoicePrompt({
    theatreName: theatreRes.data.name,
    tone: (theatreRes.data.voice_tone as VoiceTone) || 'warm',
    language: theatreRes.data.voice_language || 'ca',
    knowledgeItems: (knowledgeRes.data ?? []).map((item) => ({
      question: item.question,
      answer: item.answer,
      category: item.category,
      priority: item.priority,
      language: item.language,
    })),
    fallbackEmail: theatreRes.data.fallback_email,
    fallbackPhone: theatreRes.data.fallback_phone,
  })

  return { prompt }
}
