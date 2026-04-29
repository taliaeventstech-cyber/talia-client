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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: '1.5rem', marginTop: '2rem', marginBottom: '2rem' }}>
        <section>
          <h2>Embed</h2>
          <pre style={{ whiteSpace: 'pre-wrap', border: '1px solid #eee', borderRadius: 8, padding: '1rem', overflowX: 'auto' }}>{embedCode}</pre>
        </section>

        <section>
          <h2>Preview</h2>
          <WidgetPreview assistantName={widgetConfig.assistantName} primaryColor={widgetConfig.primaryColor} />
        </section>
      </div>

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
  const appUrl = getAppUrl()

  return `<script
  src="${appUrl}/widget.js"
  data-tenant="${tenantId}"
  data-color="${widgetConfig.primaryColor}"
  data-name="${widgetConfig.assistantName}"
></script>`
}

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function WidgetPreview({ assistantName, primaryColor }: { assistantName: string; primaryColor: string }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 8, padding: '1rem', minHeight: 220, position: 'relative', background: '#fafafa' }}>
      <div style={{ border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <div style={{ background: primaryColor, color: '#fff', padding: '0.75rem', fontWeight: 700 }}>
          {assistantName}
        </div>
        <div style={{ padding: '0.75rem', display: 'grid', gap: '0.6rem', fontSize: '0.9rem' }}>
          <p style={{ margin: 0, background: '#f1f1f1', borderRadius: 8, padding: '0.6rem' }}>
            Hola, soy {assistantName}. ¿En qué puedo ayudarte?
          </p>
          <p style={{ margin: 0, justifySelf: 'end', background: primaryColor, color: '#fff', borderRadius: 8, padding: '0.6rem' }}>
            Quiero información
          </p>
        </div>
      </div>
      <div style={{ position: 'absolute', right: 16, bottom: 16, width: 48, height: 48, borderRadius: 999, background: primaryColor, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>
        ?
      </div>
    </div>
  )
}
