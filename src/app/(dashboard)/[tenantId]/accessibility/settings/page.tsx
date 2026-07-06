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
  const embedCode = getEmbedCode(tenantId)

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
      widgetSize?: unknown
      widget_size?: unknown
      size?: unknown
      language?: unknown
      primaryColor?: unknown
      highlightColor?: unknown
    }
    : {}

  return {
    accessibility: {
      enabled: accessibility.enabled === true,
      clearViewEnabled: accessibility.clearViewEnabled !== false,
      position: getPosition(accessibility.position),
      widgetSize: getWidgetSize(accessibility.widgetSize ?? accessibility.widget_size ?? accessibility.size),
      language: getLanguage(accessibility.language),
      primaryColor: typeof accessibility.primaryColor === 'string' ? accessibility.primaryColor : primaryColor,
      highlightColor: typeof accessibility.highlightColor === 'string' ? accessibility.highlightColor : '#fffb00',
    },
  }
}

function getWidgetSize(value: unknown): 'small' | 'medium' | 'large' {
  if (value === 'small' || value === 'large') return value
  return 'medium'
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

function getEmbedCode(tenantId: string) {
  const appUrl = getAppUrl()

  return `<script
  src="${appUrl}/accessibility-widget.js"
  data-tenant="${tenantId}"
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
    widgetSize: 'small' | 'medium' | 'large'
    primaryColor: string
    highlightColor: string
  }
}) {
  const position = getPreviewPosition(values.position, 16)
  const widgetOpacity = values.enabled ? 1 : 0.46
  const widgetSize = getPreviewWidgetSize(values.widgetSize)

  return (
    <div style={{ minHeight: 360, position: 'relative', border: '1px solid var(--color-border)', borderRadius: 8, background: 'linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018))', overflow: 'hidden' }}>
      <div style={{ height: 42, borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', background: 'rgba(255,255,255,.035)' }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: '#ff6b6b' }} />
        <span style={{ width: 10, height: 10, borderRadius: 999, background: '#ffd166' }} />
        <span style={{ width: 10, height: 10, borderRadius: 999, background: '#06d6a0' }} />
        <span style={{ marginLeft: 8, width: '44%', height: 10, borderRadius: 999, background: 'rgba(255,255,255,.12)' }} />
      </div>

      <div style={{ padding: 20, display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 9 }}>
          <span style={{ width: '42%', height: 20, borderRadius: 999, background: 'rgba(255,255,255,.26)' }} />
          <span style={{ width: '76%', height: 11, borderRadius: 999, background: 'rgba(255,255,255,.13)' }} />
          <span style={{ width: '62%', height: 11, borderRadius: 999, background: 'rgba(255,255,255,.1)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 14 }}>
          <div style={{ border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: 14, display: 'grid', gap: 9, background: 'rgba(255,255,255,.035)' }}>
            <span style={{ width: '54%', height: 13, borderRadius: 999, background: 'rgba(255,255,255,.2)' }} />
            <span style={{ width: '88%', height: 10, borderRadius: 999, background: 'rgba(255,255,255,.11)' }} />
            <span style={{ width: '72%', height: 10, borderRadius: 999, background: 'rgba(255,255,255,.11)' }} />
          </div>
          <div style={{ border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: 14, display: 'grid', gap: 9, background: 'rgba(255,255,255,.025)' }}>
            <span style={{ width: '62%', height: 13, borderRadius: 999, background: 'rgba(255,255,255,.18)' }} />
            <span style={{ width: '82%', height: 10, borderRadius: 999, background: 'rgba(255,255,255,.1)' }} />
            <span style={{ width: '58%', height: 10, borderRadius: 999, background: 'rgba(255,255,255,.1)' }} />
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', inset: '42px 0 auto', height: 86, background: 'rgba(6,8,18,.42)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 178, height: 4, background: values.highlightColor, borderTop: '1px solid rgba(0,0,0,.65)', borderBottom: '1px solid rgba(255,255,255,.72)', boxShadow: '0 2px 10px rgba(0,0,0,.22)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: '220px 0 0', background: 'rgba(6,8,18,.42)', pointerEvents: 'none' }} />

      <div style={{ position: 'absolute', left: 26, right: 34, top: 128, height: 72, border: `3px solid ${values.highlightColor}`, borderRadius: 10, background: 'rgba(255,255,255,.08)', boxShadow: '0 0 0 2px rgba(17,24,39,.72), 0 10px 28px rgba(0,0,0,.22)', pointerEvents: 'none' }} />

      <div aria-hidden="true" style={{ position: 'absolute', ...position, width: widgetSize, height: widgetSize, borderRadius: 999, background: values.primaryColor, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 6px 20px rgba(0,0,0,.18)', opacity: widgetOpacity }}>
        <svg viewBox="0 0 24 24" focusable="false" width={Math.round(widgetSize * 0.68)} height={Math.round(widgetSize * 0.68)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
          <path d="M7.5 10.5h9" />
          <path d="M12 10.5v4" />
          <path d="m9 19 3-4.5 3 4.5" />
        </svg>
      </div>
    </div>
  )
}

function getPreviewWidgetSize(size: 'small' | 'medium' | 'large') {
  if (size === 'small') return 56
  if (size === 'large') return 72
  return 64
}

function getPreviewPosition(position: string, offset: number) {
  if (position === 'bottom-left') return { left: 16, bottom: offset }
  if (position === 'top-right') return { right: 16, top: offset }
  if (position === 'top-left') return { left: 16, top: offset }
  return { right: 16, bottom: offset }
}
