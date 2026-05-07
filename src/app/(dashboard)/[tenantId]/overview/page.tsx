import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { hasTenantPermission } from '@/lib/auth/permissions'
import { classifyConversationTopic } from '@/lib/analytics/topics'
import { getDictionary, getLocale, getTopicLabel } from '@/lib/i18n/dictionaries'
import { getActiveSubscription, getTenantUsageForPeriod } from '@/lib/usage/service'
import { Bot, CheckCircle2, Database, MessageSquareText, MessagesSquare, Mic2, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function OverviewPage({ params }: Props) {
  const { tenantId } = await params
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const copy = dictionary.overview
  const access = await requireTenantPermission(tenantId, 'view_overview')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [
    { data: theatre },
    { data: recentConversations },
    { count: totalConversations },
    { count: totalMessages },
    { data: topics },
    { count: knowledgeItems },
    { count: knowledgeSources },
    { count: voiceConversations },
    subscriptionResult,
    usageResult,
  ] = await Promise.all([
      admin
        .from('theatres')
        .select('name, n8n_webhook_url, scrape_urls, widget_config, fallback_email, fallback_phone, voice_enabled, voice_phone_number, voice_id, elevenlabs_agent_id, onboarding_completed')
        .eq('id', tenantId)
        .single(),
      admin
        .from('conversations')
        .select('id, session_id, started_at, message_count, metadata')
        .eq('theatre_id', tenantId)
        .order('started_at', { ascending: false })
        .limit(5),
      admin
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('theatre_id', tenantId),
      admin
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('theatre_id', tenantId),
      admin
        .from('conversation_topics')
        .select('topic, user_message, created_at')
        .eq('theatre_id', tenantId)
        .not('topic', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500),
      admin
        .from('knowledge_items')
        .select('*', { count: 'exact', head: true })
        .eq('theatre_id', tenantId)
        .eq('active', true),
      admin
        .from('knowledge_sources')
        .select('*', { count: 'exact', head: true })
        .eq('theatre_id', tenantId),
      admin
        .from('voice_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('theatre_id', tenantId),
      getActiveSubscription(admin, tenantId),
      getTenantUsageForPeriod(admin, tenantId),
    ])

  const subscription = subscriptionResult.ok ? subscriptionResult.subscription : null
  const usage = usageResult.ok ? usageResult.usage : null
  const chatLimit = subscription?.included_chat_conversations ?? 0
  const chatUsed = usage?.conversations ?? 0
  const chatRemaining = chatLimit > 0 ? Math.max(0, chatLimit - chatUsed) : null
  const chatUsagePercent = chatLimit > 0 ? Math.min(100, Math.round((chatUsed / chatLimit) * 100)) : 0

  const topTopics = getTopTopics(topics ?? [], 5)
  const latestTopics = (topics ?? [])
    .filter((item) => item.user_message)
    .slice(0, 4)
  const checklist = buildChecklist({
    tenantId,
    labels: copy.checklist,
    hasWebhook: Boolean(theatre?.n8n_webhook_url),
    hasScrapeUrls: Array.isArray(theatre?.scrape_urls) && theatre.scrape_urls.length > 0,
    hasFallbackContact: Boolean(theatre?.fallback_email || theatre?.fallback_phone),
    knowledgeItems: knowledgeItems ?? 0,
    voiceReady: Boolean(theatre?.voice_enabled && theatre?.voice_phone_number && (theatre.voice_id || theatre.elevenlabs_agent_id)),
  })

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="eyebrow">{copy.section}</p>
        <h1>{theatre?.name ?? 'Dashboard'}</h1>
        <p className="muted">{copy.description}</p>
      </header>

      <div className="kpi-row">
        <StatCard label={copy.kpis.conversations} value={totalConversations ?? 0} />
        <StatCard label={copy.kpis.messages} value={totalMessages ?? 0} />
        <StatCard label={copy.kpis.faqs} value={knowledgeItems ?? 0} />
        <StatCard label={copy.kpis.voiceCalls} value={voiceConversations ?? 0} />
      </div>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">{copy.usage.section}</p>
            <h2>{copy.usage.title}</h2>
            <p className="muted">{copy.usage.description}</p>
          </div>
          <Link className="link-accent" href={`/${tenantId}/account`}>
            {copy.usage.upgrade}
          </Link>
        </div>

        <div className="usage-plan-grid">
          <div className="usage-meter-card">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">{copy.usage.chatbot}</p>
                <strong className="usage-value">
                  {chatLimit > 0 ? `${chatUsed} / ${chatLimit}` : copy.usage.unlimited}
                </strong>
              </div>
              {chatLimit > 0 ? <span className="status-pill status-pill-active">{chatUsagePercent}%</span> : null}
            </div>
            <div className="progress-track progress-track-large">
              <div className="progress-fill" style={{ width: `${chatUsagePercent}%` }} />
            </div>
            <div className="usage-meta-row">
              <span>{chatUsed} {copy.usage.used}</span>
              <span>{chatRemaining ?? copy.usage.unlimited} {chatRemaining === null ? '' : copy.usage.remaining}</span>
            </div>
          </div>

          <div className="usage-meter-card">
            <p className="eyebrow">{copy.usage.estimatedCost}</p>
            <strong className="usage-value">{formatCurrency(usage?.estimatedCostCents ?? 0)}</strong>
            <p className="muted">{subscription?.plan ?? theatre?.name ?? ''}</p>
          </div>
        </div>
      </section>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">{copy.modules.section}</p>
            <h2>{copy.modules.title}</h2>
          </div>
          {hasTenantPermission(access.role, 'manage_chatbot') ? (
            <Link className="link-accent link-with-icon" href={`/${tenantId}/settings`}>
              <SlidersHorizontal aria-hidden="true" size={14} strokeWidth={2} />
              {copy.modules.configure}
            </Link>
          ) : null}
        </div>

        <div className="overview-grid">
          <ModuleStatusCard
            icon={<Bot size={18} />}
            title={copy.modules.chatbot}
            status={dictionary.common.active}
            tone="active"
            description={theatre?.n8n_webhook_url ? copy.modules.chatbotReady : copy.modules.chatbotPending}
          />
          <ModuleStatusCard
            icon={<Mic2 size={18} />}
            title={copy.modules.voice}
            status={theatre?.voice_enabled ? dictionary.common.active : copy.modules.pending}
            tone={theatre?.voice_enabled ? 'active' : 'soon'}
            description={theatre?.voice_enabled ? copy.modules.voiceReady : copy.modules.voicePending}
          />
          <ModuleStatusCard
            icon={<MessageSquareText size={18} />}
            title={copy.modules.future}
            status={dictionary.common.soon}
            tone="soon"
            description={copy.modules.futureDescription}
          />
        </div>
      </section>

      <div className="overview-two-column">
        <section className="card stack">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">{copy.checklist.section}</p>
              <h2>{copy.checklist.title}</h2>
            </div>
            <CheckCircle2 className="section-icon" size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="checklist">
            {checklist.map((item) => (
              <ChecklistItem key={item.label} {...item} />
            ))}
          </div>
        </section>

        <section className="card stack">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">{copy.knowledge.section}</p>
              <h2>{copy.knowledge.title}</h2>
            </div>
            <Database className="section-icon" size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          <p className="muted">
            {knowledgeItems
              ? copy.knowledge.summary(knowledgeItems, knowledgeSources ?? 0)
              : copy.knowledge.empty}
          </p>
          <Link className="button-outline button-fit" href={`/${tenantId}/settings`}>
            {copy.knowledge.action}
          </Link>
        </section>
      </div>

      <section className="card stack">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
          <h2>{copy.topics.title}</h2>
          <Link className="link-accent" href={`/${tenantId}/analytics`}>{copy.topics.action}</Link>
        </div>
        {topTopics.length === 0 ? (
          <p className="muted">{copy.topics.empty}</p>
        ) : (
          <div className="stack">
            {topTopics.map((item) => (
              <TopicBar key={item.topic} topic={getTopicLabel(dictionary, item.topic)} count={item.count} max={topTopics[0].count} />
            ))}
          </div>
        )}
      </section>

      <section className="card stack">
      <div className="section-title-row">
        <h2>{copy.conversations.title}</h2>
        <Link className="link-accent" href={`/${tenantId}/conversations`}>{copy.conversations.action}</Link>
      </div>
      {recentConversations?.length === 0 ? (
        <EmptyState
          title={copy.conversations.emptyTitle}
          description={copy.conversations.emptyDescription}
          href={`/${tenantId}/settings`}
          action={copy.conversations.emptyAction}
        />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>{dictionary.conversations.table.session}</th>
              <th>{dictionary.conversations.table.email}</th>
              <th>{dictionary.conversations.table.started}</th>
              <th>{dictionary.conversations.table.messages}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recentConversations?.map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.session_id.slice(0, 16)}...</td>
                <td>{getVisitorEmail(c.metadata) ?? '-'}</td>
                <td>{new Date(c.started_at).toLocaleString('es-ES')}</td>
                <td>{c.message_count}</td>
                <td style={{ textAlign: 'right' }}>
                  <Link className="link-accent link-with-icon" href={`/${tenantId}/conversations/${c.id}`}>
                    <MessagesSquare aria-hidden="true" size={14} strokeWidth={2} />
                    {dictionary.conversations.viewMessages}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </section>

      <section className="card stack">
        <h2>{copy.intents.title}</h2>
        {latestTopics.length === 0 ? (
          <p className="muted">{copy.intents.empty}</p>
        ) : (
          <div className="intent-list">
            {latestTopics.map((item, index) => (
              <div className="intent-item" key={`${item.created_at}-${index}`}>
                <span className="channel-badge channel-badge-chat">{getTopicLabel(dictionary, classifyConversationTopic(item.topic ?? undefined, item.user_message ?? undefined))}</span>
                <p>{item.user_message}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function getVisitorEmail(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return null
  const email = (metadata as { email?: unknown; visitor_email?: unknown }).email
    ?? (metadata as { email?: unknown; visitor_email?: unknown }).visitor_email
  return typeof email === 'string' && email ? email : null
}

function getTopTopics(topics: { topic: string | null; user_message: string | null }[], limit: number) {
  const counts = new Map<string, number>()
  topics.forEach(({ topic, user_message }) => {
    const normalized = classifyConversationTopic(topic ?? undefined, user_message ?? undefined)
    if (!normalized || normalized === 'otro') return
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  })

  return Array.from(counts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

function TopicBar({ topic, count, max }: { topic: string; count: number; max: number }) {
  const width = `${Math.max(8, Math.round((count / max) * 100))}%`

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ textTransform: 'capitalize' }}>{topic}</span>
        <strong className="mono">{count}</strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width }} />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="kpi-card">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
    </div>
  )
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

function ModuleStatusCard({
  icon,
  title,
  status,
  tone,
  description,
}: {
  icon: ReactNode
  title: string
  status: string
  tone: 'active' | 'soon'
  description: string
}) {
  return (
    <div className="module-status-card">
      <div className="module-status-header">
        <span className="module-status-icon" aria-hidden="true">{icon}</span>
        <span className={`status-pill status-pill-${tone}`}>{status}</span>
      </div>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
    </div>
  )
}

function ChecklistItem({ label, done, href }: { label: string; done: boolean; href: string }) {
  return (
    <Link className={`checklist-item ${done ? 'checklist-item-done' : ''}`} href={href}>
      <span className="checklist-dot" aria-hidden="true">
        {done ? <CheckCircle2 size={14} strokeWidth={2.4} /> : null}
      </span>
      {label}
    </Link>
  )
}

function EmptyState({ title, description, href, action }: { title: string; description: string; href: string; action: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      <Link className="button-outline button-fit" href={href}>{action}</Link>
    </div>
  )
}

function buildChecklist({
  tenantId,
  labels,
  hasWebhook,
  hasScrapeUrls,
  hasFallbackContact,
  knowledgeItems,
  voiceReady,
}: {
  tenantId: string
  labels: {
    webhook: string
    scrapeUrls: string
    knowledge: string
    fallback: string
    voice: string
  }
  hasWebhook: boolean
  hasScrapeUrls: boolean
  hasFallbackContact: boolean
  knowledgeItems: number
  voiceReady: boolean
}) {
  return [
    { label: labels.webhook, done: hasWebhook, href: `/${tenantId}/settings` },
    { label: labels.scrapeUrls, done: hasScrapeUrls, href: `/${tenantId}/settings` },
    { label: labels.knowledge, done: knowledgeItems > 0, href: `/${tenantId}/settings` },
    { label: labels.fallback, done: hasFallbackContact, href: `/${tenantId}/settings` },
    { label: labels.voice, done: voiceReady, href: `/${tenantId}/voice/settings` },
  ]
}
