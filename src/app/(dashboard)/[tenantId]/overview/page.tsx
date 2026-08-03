import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { hasTenantPermission, isTenantModuleEnabled } from '@/lib/auth/permissions'
import { classifyConversationTopic } from '@/lib/analytics/topics'
import { isChatbotSetupCompleted } from '@/lib/chatbot/setup-status'
import { getDictionary, getLocale, getTopicLabel } from '@/lib/i18n/dictionaries'
import { getIntlLocale, type Locale } from '@/lib/i18n/config'
import { getActiveSubscription, getChatbotBillableMessagesForPeriod, getTenantUsageHistory, type TenantUsageHistoryEntry } from '@/lib/usage/service'
import { getWidgetEmbedCode } from '@/lib/widget/embed-code'
import { getResponseFeedbackMetrics } from '@/lib/knowledge/response-feedback-metrics'
import { CopyScriptButton } from '@/components/copy-script-button'
import { LocalDateTime } from '@/components/local-date-time'
import { Bot, CheckCircle2, Code2, Database, Mail, MessagesSquare, Plus } from 'lucide-react'
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
  const hasEmailModule = isTenantModuleEnabled(access.modules.email)
  const hasInstagramModule = isTenantModuleEnabled(access.modules.instagram)
  const canManageChatbot = isTenantModuleEnabled(access.modules.chatbot)
    && hasTenantPermission(access.role, 'manage_chatbot')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [
    { data: theatre },
    { data: recentConversations },
    { data: topics },
    { count: knowledgeItems },
    { count: knowledgeSources },
    { data: emailConnections },
    { count: emailThreads },
    { count: emailWaitingHuman },
    { data: emailDrafts },
    subscriptionResult,
  ] = await Promise.all([
      admin
        .from('theatres')
        .select('name, website_url, n8n_webhook_url, widget_config, system_prompt, fallback_email, fallback_phone, onboarding_completed')
        .eq('id', tenantId)
        .single(),
      admin
        .from('conversations')
        .select('id, session_id, started_at, message_count, metadata')
        .eq('theatre_id', tenantId)
        .order('started_at', { ascending: false })
        .limit(5),
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
    ])

  const subscription = subscriptionResult.ok ? subscriptionResult.subscription : null
  const usageHistoryResult = await getTenantUsageHistory(admin, tenantId)
  const usageHistory = usageHistoryResult.ok ? usageHistoryResult.history : []
  const currentUsage = usageHistory.find((entry) => entry.subscriptionId === subscription?.id)
    ?? usageHistory.find((entry) => entry.isCurrent)
  const chatLimit = subscription?.included_chat_conversations ?? 0
  // Botsonic model: usage shown against the plan is billable assistant replies.
  const billableResult = subscription && !currentUsage
    ? await getChatbotBillableMessagesForPeriod(admin, tenantId, {
      startAt: subscription.billing_period_start_at,
      endAt: subscription.billing_period_end_at,
    })
    : null
  const chatUsed = currentUsage?.billableChatMessages ?? (billableResult?.ok ? billableResult.count : 0)
  const currentConversations = currentUsage?.usage.conversations ?? 0
  const currentMessages = currentUsage?.usage.messages ?? 0
  const [assistantResponsesResult, positiveResponsesResult, negativeResponsesResult] = subscription
    ? await Promise.all([
      admin
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('theatre_id', tenantId)
        .eq('role', 'assistant')
        .gte('created_at', subscription.billing_period_start_at)
        .lt('created_at', subscription.billing_period_end_at),
      admin
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('theatre_id', tenantId)
        .eq('role', 'assistant')
        .contains('metadata', { feedback: { rating: 'positive' } })
        .gte('created_at', subscription.billing_period_start_at)
        .lt('created_at', subscription.billing_period_end_at),
      admin
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('theatre_id', tenantId)
        .eq('role', 'assistant')
        .contains('metadata', { feedback: { rating: 'negative' } })
        .gte('created_at', subscription.billing_period_start_at)
        .lt('created_at', subscription.billing_period_end_at),
    ])
    : [{ count: 0 }, { count: 0 }, { count: 0 }]
  const chatUsagePercent = chatLimit > 0 ? Math.min(100, Math.round((chatUsed / chatLimit) * 100)) : null
  const chatLimitReached = chatLimit > 0 && chatUsed >= chatLimit
  const chatLimitNearing = chatLimit > 0 && !chatLimitReached && chatUsed / chatLimit >= 0.8
  const topTopics = getTopTopics(topics ?? [], 5)
  const feedbackMetrics = getResponseFeedbackMetrics({
    positiveCount: positiveResponsesResult.count ?? 0,
    negativeCount: negativeResponsesResult.count ?? 0,
    totalCount: assistantResponsesResult.count ?? 0,
  })
  const latestTopics = (topics ?? [])
    .filter((item) => item.user_message)
    .slice(0, 4)
  const emailConnection = emailConnections?.[0] ?? null
  const isEmailConnected = emailConnection?.status === 'connected' || emailConnection?.status === 'syncing'
  const emailDraftsPrepared = (emailDrafts ?? []).filter((draft) => draft.status === 'generated' || draft.status === 'created_in_provider').length
  const isChatbotConfigured = isChatbotSetupCompleted({
    widgetConfig: theatre?.widget_config,
  })
  const hasScriptAccess = canManageChatbot
    && access.billingAccess.hasProductAccess
    && isChatbotConfigured
  const embedCode = theatre
    ? getWidgetEmbedCode({ tenantId, websiteUrl: theatre.website_url })
    : null
  const chatbotHref = isChatbotConfigured
    ? `/${tenantId}/settings`
    : `/${tenantId}/chatbot/setup`
  const checklist = buildChecklist({
    tenantId,
    labels: copy.checklist,
    hasWebhook: Boolean(theatre?.n8n_webhook_url),
    hasSystemPrompt: Boolean(theatre?.system_prompt?.trim()),
    hasFallbackContact: Boolean(theatre?.fallback_email || theatre?.fallback_phone),
    knowledgeItems: knowledgeItems ?? 0,
    knowledgeSources: knowledgeSources ?? 0,
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
          {chatLimitReached ? (
            <p className="plan-usage-notice plan-usage-notice--reached" role="status">{copy.usage.limitReached}</p>
          ) : chatLimitNearing ? (
            <p className="plan-usage-notice plan-usage-notice--nearing" role="status">{copy.usage.nearingLimit}</p>
          ) : null}
          <div className="summary-metric-row">
            <SummaryMetric label={copy.kpis.conversations} value={currentConversations} />
            <SummaryMetric label={copy.kpis.messages} value={currentMessages} />
            <SummaryMetric label={copy.kpis.faqs} value={knowledgeItems ?? 0} />
            <SummaryMetric
              label={copy.kpis.satisfaction(feedbackMetrics.ratedCount)}
              value={feedbackMetrics.accuracyPercent === null ? '—' : `${feedbackMetrics.accuracyPercent}%`}
            />
          </div>
        </div>
      </header>

      <UsageHistory history={usageHistory} locale={locale} copy={copy.usageHistory} />

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">{copy.modules.section}</p>
            <h2>{copy.modules.title}</h2>
            <p className="muted">{copy.modules.setupHint}</p>
          </div>
        </div>

        <div className="module-orbit-grid">
          <ModuleStatusCard
            href={chatbotHref}
            icon={<Bot size={22} />}
            label="Chatbot"
            title={copy.modules.chatbot}
            status={isChatbotConfigured ? dictionary.common.active : copy.modules.pending}
            tone={isChatbotConfigured ? 'active' : 'soon'}
            description={isChatbotConfigured ? copy.modules.chatbotReady : 'Configura tu chatbot para comenzar a utilizarlo.'}
          >
            <div className="module-mini-stats">
              <span><strong>{currentConversations}</strong>{copy.kpis.conversations}</span>
              <span><strong>{knowledgeItems ?? 0}</strong>FAQs</span>
            </div>
          </ModuleStatusCard>
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

      {canManageChatbot && embedCode ? (
        <ChatbotInstallationCard
          copy={copy.installation}
          embedCode={embedCode}
          hasScriptAccess={hasScriptAccess}
          settingsHref={chatbotHref}
          websiteUrl={getWebsiteUrl(theatre?.website_url)}
        />
      ) : null}

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
                <td><LocalDateTime value={c.started_at} locale={getIntlLocale(locale)} /></td>
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

function compactSnippet(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function getWebsiteUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
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

function SummaryMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="summary-metric">
      <span className="summary-metric-value">{value}</span>
      <span className="summary-metric-label">{label}</span>
    </div>
  )
}

function UsageHistory({
  history,
  locale,
  copy,
}: {
  history: TenantUsageHistoryEntry[]
  locale: Locale
  copy: {
    section: string
    title: string
    description: string
    period: string
    planUsage: string
    conversations: string
    visitorMessages: string
    messages: string
    current: string
    empty: string
  }
}) {
  return (
    <section className="card stack usage-history-card">
      <div>
        <p className="eyebrow">{copy.section}</p>
        <h2>{copy.title}</h2>
        <p className="muted">{copy.description}</p>
      </div>
      {history.length === 0 ? (
        <p className="muted">{copy.empty}</p>
      ) : (
        <div className="table-scroll usage-history-table-wrap">
          <table className="usage-history-table">
            <thead>
              <tr>
                <th>{copy.period}</th>
                <th>{copy.planUsage}</th>
                <th>{copy.visitorMessages}</th>
                <th>{copy.messages}</th>
                <th>{copy.conversations}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.subscriptionId}>
                  <td>
                    <div className="usage-history-period">
                      <strong>{formatUsagePeriod(entry.periodStartAt, entry.periodEndAt, locale)}</strong>
                      {entry.isCurrent ? <span className="status-pill status-pill-active">{copy.current}</span> : null}
                    </div>
                  </td>
                  <td className="mono">
                    {entry.includedChatMessages > 0
                      ? `${entry.billableChatMessages} / ${entry.includedChatMessages}`
                      : entry.billableChatMessages}
                  </td>
                  <td className="mono">{entry.visitorChatMessages}</td>
                  <td className="mono">{entry.totalChatMessages}</td>
                  <td className="mono">{entry.usage.conversations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function formatUsagePeriod(start: string, end: string, locale: Locale) {
  const startDate = new Date(start)
  const endDate = new Date(new Date(end).getTime() - 1)
  const formatter = new Intl.DateTimeFormat(getIntlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return `${formatter.format(startDate)} – ${formatter.format(endDate)}`
}

function ChatbotInstallationCard({
  copy,
  embedCode,
  hasScriptAccess,
  settingsHref,
  websiteUrl,
}: {
  copy: {
    section: string
    title: string
    description: string
    pending: string
    copy: string
    copied: string
    settings: string
    setup: string
  }
  embedCode: string
  hasScriptAccess: boolean
  settingsHref: string
  websiteUrl: string | null
}) {
  return (
    <section className="card overview-install-card">
      <div className="overview-install-copy">
        <div>
          <p className="eyebrow">{copy.section}</p>
          <div className="overview-install-title">
            <Code2 className="section-icon" size={20} strokeWidth={2} aria-hidden="true" />
            <h2>{copy.title}</h2>
          </div>
        </div>
        <p className="muted">{hasScriptAccess ? copy.description : copy.pending}</p>
        {hasScriptAccess && websiteUrl ? (
          <a
            className="overview-install-target"
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
          >
            {websiteUrl}
          </a>
        ) : null}
      </div>

      {hasScriptAccess ? (
        <div className="overview-install-snippet">
          <div className="overview-install-code" aria-label={copy.title}>
            <code>{compactSnippet(embedCode)}</code>
          </div>
          <div className="overview-install-actions">
            <CopyScriptButton
              value={embedCode}
              label={copy.copy}
              copiedLabel={copy.copied}
              showLabel
            />
            <Link className="button-outline button-fit" href={settingsHref}>{copy.settings}</Link>
          </div>
        </div>
      ) : (
        <div className="overview-install-pending">
          <span className="status-pill status-pill-soon">{copy.pending}</span>
          <Link className="button-primary button-fit" href={settingsHref}>{copy.setup}</Link>
        </div>
      )}
    </section>
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
  hasFallbackContact,
  knowledgeItems,
  knowledgeSources,
}: {
  tenantId: string
  labels: {
    webhook: string
    prompt: string
    knowledge: string
    fallback: string
  }
  hasWebhook: boolean
  hasSystemPrompt: boolean
  hasFallbackContact: boolean
  knowledgeItems: number
  knowledgeSources: number
}) {
  const items = [
    { label: labels.webhook, done: hasWebhook, href: `/${tenantId}/settings` },
    { label: labels.prompt, done: hasSystemPrompt, href: `/${tenantId}/settings` },
    { label: labels.knowledge, done: knowledgeItems > 0 || knowledgeSources > 0, href: `/${tenantId}/knowledge` },
    { label: labels.fallback, done: hasFallbackContact, href: `/${tenantId}/settings` },
  ]

  return items
}
