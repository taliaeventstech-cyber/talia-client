import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import Link from 'next/link'
import { KnowledgeForm } from './knowledge-form'
import { SettingsForm } from './settings-form'

interface Props {
  params: Promise<{ tenantId: string }>
  searchParams: Promise<{ tab?: string }>
}

type Tab = 'general' | 'knowledge' | 'preview'

export default async function SettingsPage({ params, searchParams }: Props) {
  const { tenantId } = await params
  const { tab: tabParam } = await searchParams
  const dictionary = await getDictionary(await getLocale())
  await requireTenantPermission(tenantId, 'manage_chatbot', 'chatbot')
  const tabs = [
    { value: 'general', label: dictionary.settings.tabs.general },
    { value: 'knowledge', label: dictionary.settings.tabs.knowledge },
    { value: 'preview', label: dictionary.settings.tabs.preview },
  ] satisfies { value: Tab; label: string }[]
  const activeTab: Tab = tabs.find((t) => t.value === tabParam)?.value ?? 'general'

  const admin = createAdminClient()

  const [{ data: theatre }, { data: knowledgeItems }] = await Promise.all([
    admin
      .from('theatres')
      .select('name, slug, plan, system_prompt, fallback_email, fallback_phone, scrape_urls, widget_config, n8n_webhook_url')
      .eq('id', tenantId)
      .single(),
    activeTab === 'knowledge'
      ? admin
          .from('knowledge_items')
          .select('id, question, answer, category, language, priority')
          .eq('theatre_id', tenantId)
          .eq('active', true)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ])

  const widgetConfig = getWidgetConfig(theatre?.widget_config)
  const scrapeUrls = Array.isArray(theatre?.scrape_urls)
    ? theatre.scrape_urls.filter((url): url is string => typeof url === 'string')
    : []

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="section-label">{dictionary.settings.section}</p>
        <h1>{dictionary.settings.title}</h1>
      </header>

      <div className="channel-tabs" role="tablist">
        {tabs.map(({ value, label }) => (
          <Link
            key={value}
            href={`/${tenantId}/settings?tab=${value}`}
            role="tab"
            aria-selected={activeTab === value}
            className={`channel-tab ${activeTab === value ? 'channel-tab-active' : ''}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {activeTab === 'general' && theatre ? (
        <SettingsForm
          tenantId={tenantId}
          theatre={{
            plan: theatre.plan,
            system_prompt: theatre.system_prompt,
            fallback_email: theatre.fallback_email,
            fallback_phone: theatre.fallback_phone,
          }}
          widgetConfig={{
            initialMessage: widgetConfig.initialMessage,
            primaryColor: widgetConfig.primaryColor,
            autoOpen: widgetConfig.autoOpen,
            autoOpenDelay: widgetConfig.autoOpenDelay,
          }}
          labels={dictionary.settings.form}
        />
      ) : null}

      {activeTab === 'knowledge' && theatre ? (
        <KnowledgeForm
          tenantId={tenantId}
          items={knowledgeItems ?? []}
          scrapeUrls={scrapeUrls}
          systemPrompt={theatre.system_prompt}
          labels={dictionary.settings.knowledge}
        />
      ) : null}

      {activeTab === 'preview' ? (
        <PreviewTab tenantId={tenantId} widgetConfig={widgetConfig} dictionary={dictionary} />
      ) : null}
    </main>
  )
}

function PreviewTab({
  tenantId,
  widgetConfig,
  dictionary,
}: {
  tenantId: string
  widgetConfig: ReturnType<typeof getWidgetConfig>
  dictionary: Awaited<ReturnType<typeof getDictionary>>
}) {
  const embedCode = getEmbedCode(tenantId, widgetConfig)

  return (
    <div className="two-column-grid">
      <section className="card stack">
        <h2>{dictionary.settings.integrationCode}</h2>
        <p
          className="muted"
          dangerouslySetInnerHTML={{ __html: dictionary.settings.integrationHelp }}
        />
        <pre className="ai-output" style={{ whiteSpace: 'pre-wrap' }}>{embedCode}</pre>
      </section>

      <section className="card stack">
        <h2>{dictionary.settings.preview}</h2>
        <WidgetPreview widgetConfig={widgetConfig} />
      </section>
    </div>
  )
}

function getWidgetConfig(value: unknown) {
  if (!value || typeof value !== 'object') {
    return { assistantName: 'TALIA', initialMessage: 'Hola, soc TALIA. En què et puc ajudar?', primaryColor: '#000000', autoOpen: false, autoOpenDelay: 3 }
  }

  const config = value as { assistantName?: unknown; initialMessage?: unknown; primaryColor?: unknown; autoOpen?: unknown; autoOpenDelay?: unknown }
  return {
    assistantName: typeof config.assistantName === 'string' ? config.assistantName : 'TALIA',
    initialMessage: typeof config.initialMessage === 'string' ? config.initialMessage : 'Hola, soc TALIA. En què et puc ajudar?',
    primaryColor: typeof config.primaryColor === 'string' ? config.primaryColor : '#000000',
    autoOpen: config.autoOpen === true,
    autoOpenDelay: typeof config.autoOpenDelay === 'number' ? config.autoOpenDelay : 3,
  }
}

function getEmbedCode(tenantId: string, widgetConfig: { primaryColor: string; autoOpen: boolean; autoOpenDelay: number }) {
  const appUrl = getAppUrl()
  const autoOpenAttrs = widgetConfig.autoOpen
    ? `\n  data-auto-open="true"\n  data-auto-open-delay="${widgetConfig.autoOpenDelay}"`
    : ''

  return `<script
  src="${appUrl}/widget.js"
  crossorigin="anonymous"
  data-tenant="${tenantId}"
  data-color="${widgetConfig.primaryColor}"${autoOpenAttrs}
></script>`
}

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function WidgetPreview({ widgetConfig }: { widgetConfig: { assistantName: string; initialMessage: string; primaryColor: string } }) {
  return (
    <div style={{ minHeight: 220, position: 'relative' }}>
      <div style={{ border: '0.5px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--color-surface)' }}>
        <div style={{ background: widgetConfig.primaryColor, color: '#fff', padding: '0.75rem', fontWeight: 700 }}>
          {widgetConfig.assistantName}
        </div>
        <div style={{ padding: '0.75rem', display: 'grid', gap: '0.6rem', fontSize: '0.9rem' }}>
          <p style={{ margin: 0, background: '#f1f1f1', color: '#1A1A2E', borderRadius: 8, padding: '0.6rem' }}>
            {widgetConfig.initialMessage}
          </p>
          <p style={{ margin: 0, justifySelf: 'end', background: widgetConfig.primaryColor, color: '#fff', borderRadius: 8, padding: '0.6rem' }}>
            Quiero información
          </p>
        </div>
      </div>
      <div style={{ position: 'absolute', right: 16, bottom: 16, width: 48, height: 48, borderRadius: 999, background: widgetConfig.primaryColor, color: '#fff', display: 'grid', placeItems: 'center' }}>
        <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.25 6.8C5.25 4.98 6.73 3.5 8.55 3.5h10.9c1.82 0 3.3 1.48 3.3 3.3v7.7c0 1.82-1.48 3.3-3.3 3.3h-6.17l-5.1 4.2v-4.2h.37c-1.82 0-3.3-1.48-3.3-3.3V6.8Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M10 10.5h7.2M10 14h4.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}
