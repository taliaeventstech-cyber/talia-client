import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
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
  const dictionary = await getDictionary(await getLocale())
  await requireTenantPermission(tenantId, 'manage_voice', 'voice')

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
    : dictionary.voice.missingAppUrl

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="section-label">{dictionary.voice.section}</p>
        <h1>{dictionary.voice.title}</h1>
      </header>

      <section className="card stack">
        <h2>{dictionary.voice.connectionTitle}</h2>
        <p className="muted">{dictionary.voice.connectionDescription}</p>
        <div className="form-grid">
          <label className="field">
            {dictionary.voice.webhookLabel}
            <CopyInput value={postCallWebhook} />
            <span className="field-hint">
              {dictionary.voice.webhookHint}
            </span>
          </label>
        </div>
      </section>

      <VoiceSettingsForm
        tenantId={tenantId}
        current={{
          voiceEnabled: config.voiceEnabled,
          elevenLabsAgentId: config.elevenLabsAgentId,
          voiceId: config.voiceId,
          voiceLanguage: config.voiceLanguage,
          voiceTone: config.voiceTone,
          voiceTemperature: config.voiceTemperature,
          voiceCustomPrompt: config.voiceCustomPrompt,
          voiceMaxTurns: config.voiceMaxTurns,
          generatedPrompt,
        }}
        labels={dictionary.voice.form}
      />
    </main>
  )
}
