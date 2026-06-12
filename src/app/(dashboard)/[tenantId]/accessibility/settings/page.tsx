import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { createAdminClient } from '@/lib/supabase/admin'
import { AccessibilitySettingsForm } from './accessibility-settings-form'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function AccessibilitySettingsPage({ params }: Props) {
  const { tenantId } = await params
  await requireTenantProductAccess(tenantId, 'manage_chatbot', 'chatbot')
  const dictionary = await getDictionary(await getLocale())
  const copy = dictionary.accessibilitySettings
  const admin = createAdminClient()

  const { data: theatre } = await admin
    .from('theatres')
    .select('widget_config')
    .eq('id', tenantId)
    .single()
  const widgetConfig = getWidgetConfig(theatre?.widget_config)
  const embedCode = getEmbedCode(tenantId, widgetConfig.accessibility)

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="section-label">{copy.section}</p>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.description}</p>
        </div>
      </header>

      <div className="two-column-grid">
        <AccessibilitySettingsForm
          tenantId={tenantId}
          values={widgetConfig.accessibility}
          labels={copy.form}
        />
        <section className="card stack">
          <h2>{copy.preview}</h2>
          <AccessibilityPreview values={widgetConfig.accessibility} />
        </section>
      </div>

      <section className="card stack" style={{ marginTop: '1rem' }}>
        <h2>{copy.integrationCode}</h2>
        <p className="muted">{copy.integrationHelp}</p>
        {widgetConfig.accessibility.enabled ? (
          <pre className="ai-output" style={{ whiteSpace: 'pre-wrap' }}>{embedCode}</pre>
        ) : (
          <div className="locked-panel">
            <p className="muted">{copy.disabledCode}</p>
          </div>
        )}
      </section>
    </main>
  )
}

function getWidgetConfig(value: unknown) {
  const config = value && typeof value === 'object' && !Array.isArray(value)
    ? value as { primaryColor?: unknown; accessibility?: unknown }
    : {}
  const primaryColor = typeof config.primaryColor === 'string' ? config.primaryColor : '#00e0c7'
  const accessibility = config.accessibility && typeof config.accessibility === 'object' && !Array.isArray(config.accessibility)
    ? config.accessibility as {
      enabled?: unknown
      clearViewEnabled?: unknown
      position?: unknown
      language?: unknown
      primaryColor?: unknown
    }
    : {}

  return {
    accessibility: {
      enabled: accessibility.enabled === true,
      clearViewEnabled: accessibility.clearViewEnabled !== false,
      position: getPosition(accessibility.position),
      language: getLanguage(accessibility.language),
      primaryColor: typeof accessibility.primaryColor === 'string' ? accessibility.primaryColor : primaryColor,
    },
  }
}

function getPosition(value: unknown) {
  if (
    value === 'bottom-right' ||
    value === 'bottom-left' ||
    value === 'top-right' ||
    value === 'top-left'
  ) {
    return value
  }

  return 'bottom-right'
}

function getLanguage(value: unknown) {
  if (value === 'auto' || value === 'es' || value === 'ca' || value === 'en') return value
  return 'auto'
}

function getEmbedCode(
  tenantId: string,
  values: {
    position: string
    language: string
    primaryColor: string
    clearViewEnabled: boolean
  }
) {
  const appUrl = getAppUrl()

  return `<script
  src="${appUrl}/accessibility-widget.js"
  data-tenant="${tenantId}"
  data-color="${values.primaryColor}"
  data-position="${values.position}"
  data-language="${values.language}"
  data-clear-view="${values.clearViewEnabled ? 'true' : 'false'}"
></script>`
}

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function AccessibilityPreview({
  values,
}: {
  values: {
    enabled: boolean
    clearViewEnabled: boolean
    position: string
    primaryColor: string
  }
}) {
  const position = getPreviewPosition(values.position, 16)

  return (
    <div style={{ minHeight: 260, position: 'relative', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface-muted)', overflow: 'hidden' }}>
      <div style={{ padding: 18, display: 'grid', gap: 10 }}>
        <span style={{ width: '55%', height: 14, borderRadius: 999, background: 'rgba(120,120,140,.22)' }} />
        <span style={{ width: '78%', height: 14, borderRadius: 999, background: 'rgba(120,120,140,.16)' }} />
        <span style={{ width: '68%', height: 14, borderRadius: 999, background: 'rgba(120,120,140,.16)' }} />
      </div>
      {values.enabled ? (
        <div style={{ position: 'absolute', ...position, width: 48, height: 48, borderRadius: 999, background: values.primaryColor, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 6px 20px rgba(0,0,0,.18)' }}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="29" height="29" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
            <path d="M7.5 10.5h9" />
            <path d="M12 10.5v4" />
            <path d="m9 19 3-4.5 3 4.5" />
          </svg>
        </div>
      ) : null}
    </div>
  )
}

function getPreviewPosition(position: string, offset: number) {
  if (position === 'bottom-left') return { left: 16, bottom: offset }
  if (position === 'top-right') return { right: 16, top: offset }
  if (position === 'top-left') return { left: 16, top: offset }
  return { right: 16, bottom: offset }
}
