import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'

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

  async function updateSettings(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const admin = createAdminClient()
    const { data: membership } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .eq('theatre_id', tenantId)
      .single()

    if (!membership || membership.role !== 'admin') redirect('/login')

    const urls = ['scrape_url_1', 'scrape_url_2', 'scrape_url_3', 'scrape_url_4']
      .map((key) => String(formData.get(key) ?? '').trim())
      .filter(Boolean)

    const assistantName = String(formData.get('assistant_name') ?? 'TALIA').trim() || 'TALIA'
    const primaryColor = String(formData.get('primary_color') ?? '#000000').trim() || '#000000'

    await admin
      .from('theatres')
      .update({
        plan: String(formData.get('plan') ?? 'esencial'),
        system_prompt: emptyToNull(formData.get('system_prompt')),
        fallback_email: emptyToNull(formData.get('fallback_email')),
        fallback_phone: emptyToNull(formData.get('fallback_phone')),
        scrape_urls: urls,
        widget_config: {
          assistantName,
          primaryColor,
        },
      })
      .eq('id', tenantId)

    revalidatePath(`/${tenantId}/settings`)
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <h1>Configuración</h1>
      <p>Teatro: {theatre?.name}</p>

      <section style={{ marginTop: '2rem', marginBottom: '2rem' }}>
        <h2>Embed</h2>
        <pre style={{ whiteSpace: 'pre-wrap', border: '1px solid #eee', borderRadius: 8, padding: '1rem' }}>{embedCode}</pre>
      </section>

      <form action={updateSettings} style={{ display: 'grid', gap: '1.5rem' }}>
        <section>
          <h2>Chatbot</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <label style={fieldStyle}>
              Plan
              <select name="plan" defaultValue={theatre?.plan ?? 'esencial'} style={inputStyle}>
                <option value="esencial">Esencial</option>
                <option value="profesional">Profesional</option>
                <option value="pro">Pro</option>
              </select>
            </label>

            <label style={fieldStyle}>
              Nombre del asistente
              <input name="assistant_name" defaultValue={widgetConfig.assistantName} style={inputStyle} />
            </label>

            <label style={fieldStyle}>
              Color principal
              <input name="primary_color" type="color" defaultValue={widgetConfig.primaryColor} style={{ ...inputStyle, height: 44 }} />
            </label>

            <label style={fieldStyle}>
              Email fallback
              <input name="fallback_email" type="email" defaultValue={theatre?.fallback_email ?? ''} style={inputStyle} />
            </label>

            <label style={fieldStyle}>
              Teléfono fallback
              <input name="fallback_phone" defaultValue={theatre?.fallback_phone ?? ''} style={inputStyle} />
            </label>
          </div>
        </section>

        <section>
          <h2>Prompt base</h2>
          <textarea
            name="system_prompt"
            defaultValue={theatre?.system_prompt ?? ''}
            rows={12}
            style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
          />
        </section>

        <section>
          <h2>URLs scrapeables</h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {[0, 1, 2, 3].map((index) => (
              <input
                key={index}
                name={`scrape_url_${index + 1}`}
                defaultValue={scrapeUrls[index] ?? ''}
                placeholder="https://..."
                style={inputStyle}
              />
            ))}
          </div>
        </section>

        <button type="submit" style={buttonStyle}>Guardar configuración</button>
      </form>
    </main>
  )
}

function emptyToNull(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text || null
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

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
  fontWeight: 600,
}

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: '0.75rem',
  font: 'inherit',
}

const buttonStyle: CSSProperties = {
  width: 'fit-content',
  border: 0,
  borderRadius: 8,
  padding: '0.8rem 1rem',
  background: '#111',
  color: '#fff',
  font: 'inherit',
  cursor: 'pointer',
}
