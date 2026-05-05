import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantVoiceConfig } from '@/lib/tenants/service'
import { buildVoicePrompt, type VoiceTone } from '@/lib/voice/prompt-builder'
import { redirect } from 'next/navigation'
import { VoiceSettingsForm } from './voice-settings-form'
import { CopyInput } from './copy-input'

interface Props {
  params: Promise<{ tenantId: string }>
}

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
}

export default async function VoiceSettingsPage({ params }: Props) {
  const { tenantId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const result = await getTenantVoiceConfig(admin, tenantId)
  if (!result.ok) redirect('/login')

  const { config } = result

  const generatedPrompt = buildVoicePrompt({
    theatreName: config.name,
    tone: (config.voiceTone as VoiceTone) || 'warm',
    language: config.voiceLanguage,
    knowledgeItems: config.knowledgeItems,
    fallbackEmail: config.fallbackEmail,
    fallbackPhone: config.fallbackPhone,
  })

  const appUrl = getAppUrl()
  const postCallWebhook = appUrl
    ? `${appUrl}/api/voice/conversations`
    : '— configura NEXT_PUBLIC_APP_URL en las variables de entorno —'

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="section-label">Agente de voz</p>
        <h1>Configuración</h1>
      </header>

      <section className="card stack">
        <h2>Conexión con ElevenLabs</h2>
        <p className="muted">
          Cada teatro tiene su propio agente en ElevenLabs Conversational AI. Configura el webhook post-llamada
          para que TALIA registre las conversaciones automáticamente.
        </p>
        <div className="form-grid">
          <label className="field">
            Post-call webhook (ElevenLabs → TALIA)
            <CopyInput value={postCallWebhook} />
            <span className="field-hint">
              ElevenLabs → Agentes → [tu agente] → Análisis → Post-call webhook → pega esta URL
            </span>
          </label>
        </div>
      </section>

      <VoiceSettingsForm
        tenantId={tenantId}
        current={{
          voiceEnabled: config.voiceEnabled,
          elevenLabsAgentId: config.elevenLabsAgentId,
          voicePhoneNumber: config.voicePhoneNumber,
          voiceId: config.voiceId,
          voiceLanguage: config.voiceLanguage,
          voiceTone: config.voiceTone,
          voiceTemperature: config.voiceTemperature,
          voiceCustomPrompt: config.voiceCustomPrompt,
          voiceMaxTurns: config.voiceMaxTurns,
          generatedPrompt,
        }}
      />
    </main>
  )
}
