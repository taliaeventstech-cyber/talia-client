import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { classifyConversationTopic } from '@/lib/analytics/topics'
import { getDictionary, getLocale, getTopicLabel } from '@/lib/i18n/dictionaries'
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
  await requireTenantPermission(tenantId, 'view_analytics', 'data')
  const tabs = [
    { value: 'intencion', label: dictionary.analytics.tabs.intent },
    { value: 'temas', label: dictionary.analytics.tabs.topics },
  ]
  const activeTab = tabs.find((t) => t.value === tabParam)?.value ?? 'intencion'

  const admin = createAdminClient()

  const { data: topics } = await admin
    .from('conversation_topics')
    .select('topic, user_message, created_at')
    .eq('theatre_id', tenantId)
    .eq('channel', 'web')
    .order('created_at', { ascending: false })
    .limit(500)

  const normalizedTopics = (topics ?? []).map((t) => ({
    ...t,
    topic: classifyConversationTopic(t.topic ?? undefined, t.user_message ?? undefined),
  }))

  const topTopics = getTopTopics(normalizedTopics)
  const recentTopics = normalizedTopics.slice(0, 50)

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="section-label">{dictionary.analytics.section}</p>
        <h1>{dictionary.analytics.title}</h1>
        <p className="muted">{dictionary.analytics.description}</p>
      </header>

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
          {topTopics.length === 0 ? (
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
                {topTopics.map((item) => (
                  <tr key={item.topic}>
                    <td>{getTopicLabel(dictionary, item.topic)}</td>
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

function getTopTopics(topics: { topic: string }[]) {
  const counts = new Map<string, number>()
  topics.forEach(({ topic }) => {
    if (!topic || topic === 'otro') return
    counts.set(topic, (counts.get(topic) ?? 0) + 1)
  })
  const total = Array.from(counts.values()).reduce((sum, n) => sum + n, 0)
  return Array.from(counts.entries())
    .map(([topic, count]) => ({
      topic,
      count,
      percentage: total === 0 ? 0 : Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
}
