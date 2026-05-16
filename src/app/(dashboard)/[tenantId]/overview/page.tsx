import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { hasTenantPermission, isTenantModuleEnabled } from '@/lib/auth/permissions'
import { classifyConversationTopic } from '@/lib/analytics/topics'
import { getDictionary, getLocale, getTopicLabel } from '@/lib/i18n/dictionaries'
import { getActiveSubscription, getTenantUsageForPeriod } from '@/lib/usage/service'
import { Bot, CheckCircle2, Database, Mail, MessagesSquare, Mic2, Plus, SlidersHorizontal } from 'lucide-react'
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
  const hasVoiceModule = isTenantModuleEnabled(access.modules.voice)
  const hasEmailModule = isTenantModuleEnabled(access.modules.email)
  const hasInstagramModule = isTenantModuleEnabled(access.modules.instagram)
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
    { data: emailConnections },
    { count: emailThreads },
    { count: emailWaitingHuman },
    { data: emailDrafts },
    subscriptionResult,
    usageResult,
  ] = await Promise.all([
      admin
        .from('theatres')
        .select('name, n8n_webhook_url, scrape_urls, widget_config, system_prompt, fallback_email, fallback_phone, voice_enabled, voice_phone_number, voice_id, elevenlabs_agent_id, onboarding_completed')
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
      hasEmailModule
        ? admin
          .from('email_connections')
          .select('mailbox_email, status, draft_mode, sync_mode, last_synced_at')
          .eq('theatre_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1)
        : Promise.resolve({ data: [] }),
      hasEmailModule
        ? admin
          .from('email_threads')
          .select('id', { count: 'exact', head: true })
          .eq('theatre_id', tenantId)
        : Promise.resolve({ count: 0 }),
      hasEmailModule
        ? admin
          .from('email_threads')
          .select('id', { count: 'exact', head: true })
          .eq('theatre_id', tenantId)
          .eq('status', 'waiting_human')
        : Promise.resolve({ count: 0 }),
      hasEmailModule
        ? admin
          .from('email_drafts')
          .select('id, status')
          .eq('theatre_id', tenantId)
        : Promise.resolve({ data: [] }),
      getActiveSubscription(admin, tenantId),
      getTenantUsageForPeriod(admin, tenantId),
    ])

  const subscription = subscriptionResult.ok ? subscriptionResult.subscription : null
  const usage = usageResult.ok ? usageResult.usage : null
  const chatLimit = subscription?.included_chat_conversations ?? 0
  const chatUsed = usage?.conversations ?? 0
  const chatUsagePercent = chatLimit > 0 ? Math.min(100, Math.round((chatUsed / chatLimit) * 100)) : null
  const topTopics = getTopTopics(topics ?? [], 5)
  const latestTopics = (topics ?? [])
    .filter((item) => item.user_message)
    .slice(0, 4)
  const emailConnection = emailConnections?.[0] ?? null
  const isEmailConnected = emailConnection?.status === 'connected' || emailConnection?.status === 'syncing'
  const emailDraftsPrepared = (emailDrafts ?? []).filter((draft) => draft.status === 'generated' || draft.status === 'created_in_provider').length
  const canConfigureModules = hasTenantPermission(access.role, 'manage_chatbot')
    || hasTenantPermission(access.role, 'manage_knowledge')
    || (hasEmailModule && hasTenantPermission(access.role, 'manage_email'))
  const checklist = buildChecklist({
    tenantId,
    labels: copy.checklist,
    hasWebhook: Boolean(theatre?.n8n_webhook_url),
    hasSystemPrompt: Boolean(theatre?.system_prompt?.trim()),
    hasScrapeUrls: Array.isArray(theatre?.scrape_urls) && theatre.scrape_urls.length > 0,
    hasFallbackContact: Boolean(theatre?.fallback_email || theatre?.fallback_phone),
    knowledgeItems: knowledgeItems ?? 0,
    includeVoice: hasVoiceModule,
    voiceReady: Boolean(theatre?.voice_enabled && theatre?.voice_phone_number && (theatre.voice_id || theatre.elevenlabs_agent_id)),
  })

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">{copy.section}</p>
          <h1>{theatre?.name ?? 'Dashboard'}</h1>
          <p className="muted">{copy.description}</p>
        </div>
        <div className="overview-summary-card" aria-label={copy.section}>
          <div className="plan-usage-compact">
            <div>
              <span className="mini-stat-label">{copy.usage.title}</span>
              <strong className="plan-usage-value">
                {chatLimit > 0 ? `${chatUsed}/${chatLimit}` : copy.usage.unlimited}
              </strong>
            </div>
            {chatUsagePercent === null ? null : (
              <span className="plan-usage-percent">{chatUsagePercent}%</span>
            )}
          </div>
          {chatUsagePercent === null ? null : (
            <div className="progress-track plan-usage-track" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${chatUsagePercent}%` }} />
            </div>
          )}
          <div className="summary-metric-row">
            <SummaryMetric label={copy.kpis.conversations} value={totalConversations ?? 0} />
            <SummaryMetric label={copy.kpis.messages} value={totalMessages ?? 0} />
            <SummaryMetric label={copy.kpis.faqs} value={knowledgeItems ?? 0} />
            {hasVoiceModule ? <SummaryMetric label={copy.kpis.voiceCalls} value={voiceConversations ?? 0} /> : null}
          </div>
        </div>
      </header>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">{copy.modules.section}</p>
            <h2>{copy.modules.title}</h2>
          </div>
          {canConfigureModules ? (
            <details className="row-action-menu module-config-menu">
              <summary className="link-accent link-with-icon">
                <SlidersHorizontal aria-hidden="true" size={14} strokeWidth={2} />
                {copy.modules.configure}
              </summary>
              <div className="row-action-menu-content">
                {hasTenantPermission(access.role, 'manage_chatbot') ? (
                  <Link className="row-action-menu-item" href={`/${tenantId}/settings`}>
                    <Bot aria-hidden="true" size={14} strokeWidth={2} />
                    Chatbot
                  </Link>
                ) : null}
                {hasTenantPermission(access.role, 'manage_knowledge') ? (
                  <Link className="row-action-menu-item" href={`/${tenantId}/knowledge`}>
                    <Database aria-hidden="true" size={14} strokeWidth={2} />
                    Conocimiento
                  </Link>
                ) : null}
                {hasEmailModule && hasTenantPermission(access.role, 'manage_email') ? (
                  <Link className="row-action-menu-item" href={`/${tenantId}/email`}>
                    <Mail aria-hidden="true" size={14} strokeWidth={2} />
                    Email
                  </Link>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>

        <div className="module-orbit-grid">
          <ModuleStatusCard
            href={`/${tenantId}/settings`}
            icon={<Bot size={22} />}
            label="Chatbot"
            title={copy.modules.chatbot}
            status={dictionary.common.active}
            tone="active"
            description={theatre?.n8n_webhook_url ? copy.modules.chatbotReady : copy.modules.chatbotPending}
          >
            <div className="module-mini-stats">
              <span><strong>{totalConversations ?? 0}</strong>Conversaciones</span>
              <span><strong>{knowledgeItems ?? 0}</strong>FAQs</span>
            </div>
          </ModuleStatusCard>
          {hasVoiceModule ? (
            <ModuleStatusCard
              href={`/${tenantId}/overview`}
              icon={<Mic2 size={22} />}
              label="Voz"
              title={copy.modules.voice}
              status={theatre?.voice_enabled ? dictionary.common.active : copy.modules.pending}
              tone={theatre?.voice_enabled ? 'active' : 'soon'}
              description={theatre?.voice_enabled ? copy.modules.voiceReady : copy.modules.voicePending}
            >
            <div className="module-mini-stats">
              <span><strong>{voiceConversations ?? 0}</strong>Llamadas</span>
            </div>
            </ModuleStatusCard>
          ) : null}
          {hasEmailModule ? (
            <ModuleStatusCard
              href={`/${tenantId}/email`}
              icon={<Mail size={22} />}
              label="Email"
              title={copy.modules.email}
              status={isEmailConnected ? dictionary.common.active : copy.modules.pending}
              tone={isEmailConnected ? 'active' : 'soon'}
              description={isEmailConnected ? copy.modules.emailReady : copy.modules.emailPending}
            >
              <div className="module-mini-stats">
                <span><strong>{emailThreads ?? 0}</strong>Bandeja</span>
                <span><strong>{emailDraftsPrepared}</strong>Respuestas</span>
                <span><strong>{emailWaitingHuman ?? 0}</strong>Revisión</span>
              </div>
            </ModuleStatusCard>
          ) : null}
          {hasInstagramModule ? (
            <ModuleStatusCard
              href={`/${tenantId}/overview`}
              icon={<MessagesSquare size={22} />}
              label="Instagram"
              title={copy.modules.instagram}
              status={dictionary.common.soon}
              tone="soon"
              description={copy.modules.instagramPending}
            />
          ) : null}
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

        <section className="card knowledge-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">{copy.knowledge.section}</p>
              <h2>{copy.knowledge.title}</h2>
            </div>
            <Database className="section-icon" size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="knowledge-card-body">
            <p className="muted">
              {knowledgeItems
                ? copy.knowledge.summary(knowledgeItems, knowledgeSources ?? 0)
                : copy.knowledge.empty}
            </p>
            {knowledgeItems ? (
              <div className="knowledge-mini-stats" aria-label={copy.knowledge.section}>
                <span><strong>{knowledgeItems}</strong>{copy.kpis.faqs}</span>
                <span><strong>{knowledgeSources ?? 0}</strong>{copy.knowledge.section}</span>
              </div>
            ) : null}
          </div>
          <Link className="button-outline button-fit link-with-icon" href={`/${tenantId}/knowledge`}>
            <Plus aria-hidden="true" size={14} strokeWidth={2.2} />
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

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="summary-metric">
      <span className="summary-metric-value">{value}</span>
      <span className="summary-metric-label">{label}</span>
    </div>
  )
}

function ModuleStatusCard({
  href,
  icon,
  label,
  title,
  status,
  tone,
  description,
  children,
}: {
  href: string
  icon: ReactNode
  label: string
  title: string
  status: string
  tone: 'active' | 'soon'
  description: string
  children?: ReactNode
}) {
  return (
    <Link className="module-status-tile" href={href} aria-label={`${title}: ${status}`}>
      <span className={`module-status-icon module-status-icon-${tone}`} aria-hidden="true">{icon}</span>
      <span className="module-status-label">{label}</span>
      <span className="module-status-popover" aria-hidden="true">
        <span className="module-status-header">
          <span className="module-status-popover-icon">{icon}</span>
          <span className={`status-pill status-pill-${tone}`}>{status}</span>
        </span>
        <strong>{title}</strong>
        <span className="muted">{description}</span>
        {children}
      </span>
    </Link>
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
  hasSystemPrompt,
  hasScrapeUrls,
  hasFallbackContact,
  knowledgeItems,
  includeVoice,
  voiceReady,
}: {
  tenantId: string
  labels: {
    webhook: string
    prompt: string
    scrapeUrls: string
    knowledge: string
    fallback: string
    voice: string
  }
  hasWebhook: boolean
  hasSystemPrompt: boolean
  hasScrapeUrls: boolean
  hasFallbackContact: boolean
  knowledgeItems: number
  includeVoice: boolean
  voiceReady: boolean
}) {
  const items = [
    { label: labels.webhook, done: hasWebhook, href: `/${tenantId}/settings` },
    { label: labels.prompt, done: hasSystemPrompt, href: `/${tenantId}/settings` },
    { label: labels.scrapeUrls, done: hasScrapeUrls, href: `/${tenantId}/settings` },
    { label: labels.knowledge, done: knowledgeItems > 0, href: `/${tenantId}/settings` },
    { label: labels.fallback, done: hasFallbackContact, href: `/${tenantId}/settings` },
  ]

  if (includeVoice) {
    items.push({ label: labels.voice, done: voiceReady, href: `/${tenantId}/voice/settings` })
  }

  return items
}
