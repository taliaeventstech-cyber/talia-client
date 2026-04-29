import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SettingsForm } from './settings-form'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { tenantId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: theatre } = await admin
    .from('theatres')
    .select('name, slug, plan, system_prompt, fallback_email, fallback_phone, scrape_urls, widget_config, n8n_webhook_url')
    .eq('id', tenantId)
    .single()
  const widgetConfig = getWidgetConfig(theatre?.widget_config)
  const scrapeUrls = Array.isArray(theatre?.scrape_urls)
    ? theatre.scrape_urls.filter((url): url is string => typeof url === 'string')
    : []
  const embedCode = getEmbedCode(tenantId, widgetConfig)

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <h1>Configuración</h1>
      <p>Teatro: {theatre?.name}</p>

      <section style={{ marginTop: '2rem', marginBottom: '2rem' }}>
        <h2>Embed</h2>
        <pre style={{ whiteSpace: 'pre-wrap', border: '1px solid #eee', borderRadius: 8, padding: '1rem' }}>{embedCode}</pre>
      </section>

      {theatre ? (
        <SettingsForm
          tenantId={tenantId}
          theatre={{
            plan: theatre.plan,
            system_prompt: theatre.system_prompt,
            fallback_email: theatre.fallback_email,
            fallback_phone: theatre.fallback_phone,
          }}
          widgetConfig={widgetConfig}
          scrapeUrls={scrapeUrls}
        />
      ) : null}
    </main>
  )
}

function getWidgetConfig(value: unknown) {
  if (!value || typeof value !== 'object') {
    return { assistantName: 'TALIA', primaryColor: '#000000' }
  }

  const config = value as { assistantName?: unknown; primaryColor?: unknown }
  return {
    assistantName: typeof config.assistantName === 'string' ? config.assistantName : 'TALIA',
    primaryColor: typeof config.primaryColor === 'string' ? config.primaryColor : '#000000',
  }
}

function getEmbedCode(tenantId: string, widgetConfig: { assistantName: string; primaryColor: string }) {
  return `<script
  src="https://talia.app/widget.js"
  data-tenant="${tenantId}"
  data-color="${widgetConfig.primaryColor}"
  data-name="${widgetConfig.assistantName}"
></script>`
}
