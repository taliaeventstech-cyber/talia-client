import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

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

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <h1>Configuración</h1>
      <p>Teatro: {theatre?.name}</p>

      <section style={{ marginTop: '2rem' }}>
        <h2>Config del chatbot</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '0.75rem 1rem' }}>
          <dt>Plan</dt>
          <dd style={{ margin: 0 }}>{theatre?.plan ?? '-'}</dd>
          <dt>Email fallback</dt>
          <dd style={{ margin: 0 }}>{theatre?.fallback_email ?? '-'}</dd>
          <dt>Teléfono fallback</dt>
          <dd style={{ margin: 0 }}>{theatre?.fallback_phone ?? '-'}</dd>
          <dt>Webhook n8n</dt>
          <dd style={{ margin: 0 }}>{theatre?.n8n_webhook_url ?? '-'}</dd>
        </dl>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Prompt base</h2>
        <pre style={{ whiteSpace: 'pre-wrap', border: '1px solid #eee', borderRadius: 8, padding: '1rem' }}>
          {theatre?.system_prompt ?? 'Sin prompt personalizado.'}
        </pre>
      </section>
    </main>
  )
}
