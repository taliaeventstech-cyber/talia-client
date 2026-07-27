import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { classifyConversationTopic } from '@/lib/analytics/topics'
import { getDictionary, getLocale, getTopicLabel } from '@/lib/i18n/dictionaries'
import { getResponseFeedbackMetrics } from '@/lib/knowledge/response-feedback-metrics'
import Link from 'next/link'

interface Props {
  params: Promise<{ tenantId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function AnalyticsPage({ params, searchParams }: Props) {
  const { tenantId } = await params
  const { tab: tabParam } = await searchParams
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  await requireTenantProductAccess(tenantId, 'view_analytics', 'data')
  const tabs = [
    { value: 'intencion', label: dictionary.analytics.tabs.intent },
    { value: 'temas', label: dictionary.analytics.tabs.topics },
  ]
  const activeTab = tabs.find((t) => t.value === tabParam)?.value ?? 'intencion'

  const admin = createAdminClient()

  const [
    { data: topics },
    { count: totalResponses },
    { count: positiveResponses },
    { count: negativeResponses },
  ] = await Promise.all([
    admin
      .from('conversation_topics')
      .select('topic, intent, user_message, created_at')
      .eq('theatre_id', tenantId)
      .eq('channel', 'web')
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('theatre_id', tenantId)
      .eq('role', 'assistant'),
    admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('theatre_id', tenantId)
      .eq('role', 'assistant')
      .contains('metadata', { feedback: { rating: 'positive' } }),
    admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('theatre_id', tenantId)
      .eq('role', 'assistant')
      .contains('metadata', { feedback: { rating: 'negative' } }),
  ])

  const normalizedTopics = (topics ?? []).map((t) => ({
    ...t,
    topic: classifyConversationTopic(t.topic ?? undefined, t.user_message ?? undefined),
    intent: normalizeConversationIntent(t.intent, t.topic),
  }))

  const topIntents = getTopIntents(normalizedTopics)
  const recentTopics = normalizedTopics.slice(0, 50)
  const feedbackMetrics = getResponseFeedbackMetrics({
    positiveCount: positiveResponses ?? 0,
    negativeCount: negativeResponses ?? 0,
    totalCount: totalResponses ?? 0,
  })

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="section-label">{dictionary.analytics.section}</p>
        <h1>{dictionary.analytics.title}</h1>
        <p className="muted">{dictionary.analytics.description}</p>
      </header>

      <section className="card stack analytics-feedback-section" aria-labelledby="response-satisfaction-title">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">{dictionary.analytics.feedback.section}</p>
            <h2 id="response-satisfaction-title">{dictionary.analytics.feedback.title}</h2>
            <p className="muted">{dictionary.analytics.feedback.description}</p>
          </div>
          <div className="analytics-feedback-score">
            <span>{dictionary.analytics.feedback.accuracy}</span>
            <strong>
              {feedbackMetrics.accuracyPercent === null
                ? dictionary.analytics.feedback.noData
                : `${feedbackMetrics.accuracyPercent}%`}
            </strong>
          </div>
        </div>

        <div className="analytics-feedback-grid">
          <div>
            <span>{dictionary.analytics.feedback.positive}</span>
            <strong>{feedbackMetrics.positiveCount}</strong>
          </div>
          <div>
            <span>{dictionary.analytics.feedback.negative}</span>
            <strong>{feedbackMetrics.negativeCount}</strong>
          </div>
          <div>
            <span>{dictionary.analytics.feedback.rated}</span>
            <strong>{feedbackMetrics.ratedCount}</strong>
          </div>
        </div>

        <div className="analytics-feedback-coverage">
          <div>
            <span>{dictionary.analytics.feedback.coverage}</span>
            <strong>{feedbackMetrics.coveragePercent}%</strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label={dictionary.analytics.feedback.coverage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={feedbackMetrics.coveragePercent}
          >
            <div className="progress-fill" style={{ width: `${feedbackMetrics.coveragePercent}%` }} />
          </div>
          <small>
            {dictionary.analytics.feedback.coverageDetail(
              feedbackMetrics.ratedCount,
              feedbackMetrics.totalCount
            )}
          </small>
        </div>

        <p className="muted analytics-feedback-method">{dictionary.analytics.feedback.method}</p>
      </section>

      <div className="channel-tabs" role="tablist">
        {tabs.map(({ value, label }) => {
          const href = `/${tenantId}/analytics?tab=${value}`
          const isActive = activeTab === value
          return (
            <Link
              key={value}
              href={href}
              role="tab"
              aria-selected={isActive}
              className={`channel-tab ${isActive ? 'channel-tab-active' : ''}`}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {activeTab === 'intencion' && (
        <section className="card stack">
          <h2>{dictionary.analytics.intentTitle}</h2>
          <p className="muted">{dictionary.analytics.intentDescription}</p>
          {topIntents.length === 0 ? (
            <p className="muted">{dictionary.analytics.noData}</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{dictionary.analytics.table.category}</th>
                  <th>{dictionary.analytics.table.conversations}</th>
                  <th>{dictionary.analytics.table.weight}</th>
                </tr>
              </thead>
              <tbody>
                {topIntents.map((item) => (
                  <tr key={item.intent}>
                    <td>{dictionary.analytics.intents[item.intent]}</td>
                    <td>{item.count}</td>
                    <td>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${item.percentage}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {activeTab === 'temas' && (
        <section className="card stack">
          <h2>{dictionary.analytics.recentTitle}</h2>
          <p className="muted">{dictionary.analytics.recentDescription}</p>
          {recentTopics.length === 0 ? (
            <p className="muted">{dictionary.analytics.noQuestions}</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{dictionary.analytics.table.topic}</th>
                  <th>{dictionary.analytics.table.question}</th>
                  <th>{dictionary.analytics.table.date}</th>
                </tr>
              </thead>
              <tbody>
                {recentTopics.map((topic, index) => (
                  <tr key={`${topic.created_at}-${index}`}>
                    <td>{getTopicLabel(dictionary, topic.topic)}</td>
                    <td>{topic.user_message ?? dictionary.common.empty}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {topic.created_at ? new Date(topic.created_at).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES') : dictionary.common.empty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </main>
  )
}

type ConversationIntent = 'information' | 'planning' | 'transaction' | 'navigation' | 'support' | 'greeting' | 'other'

function getTopIntents(rows: { intent: ConversationIntent }[]) {
  const counts = new Map<string, number>()
  rows.forEach(({ intent }) => {
    if (intent === 'greeting' || intent === 'other') return
    counts.set(intent, (counts.get(intent) ?? 0) + 1)
  })
  const total = Array.from(counts.values()).reduce((sum, n) => sum + n, 0)
  return Array.from(counts.entries())
    .map(([intent, count]) => ({
      intent: intent as Exclude<ConversationIntent, 'greeting' | 'other'>,
      count,
      percentage: total === 0 ? 0 : Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
}

function normalizeConversationIntent(intent: string | null, topic: string | null): ConversationIntent {
  if (
    intent === 'information'
    || intent === 'planning'
    || intent === 'transaction'
    || intent === 'navigation'
    || intent === 'support'
    || intent === 'greeting'
    || intent === 'other'
  ) return intent

  if (topic === 'ubicacion') return 'navigation'
  if (topic === 'entradas') return 'transaction'
  if (topic === 'agenda' || topic === 'horarios' || topic === 'visita' || topic === 'accesibilidad') return 'planning'
  if (topic === 'precios') return 'information'
  return 'other'
}
