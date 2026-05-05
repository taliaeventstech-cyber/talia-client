import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { classifyConversationTopic } from '@/lib/analytics/topics'
import type { Channel } from '@/lib/analytics/topics'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface Props {
  params: Promise<{ tenantId: string }>
  searchParams: Promise<{ channel?: string }>
}

const CHANNELS: { value: Channel | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'web', label: 'Chatbot web' },
  { value: 'email', label: 'Email' },
  { value: 'voice', label: 'Voz' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

const CHANNEL_LABELS: Record<string, string> = {
  web: 'Chatbot',
  email: 'Email',
  voice: 'Voz',
  whatsapp: 'WhatsApp',
}

const CHANNEL_COLORS: Record<string, string> = {
  web: 'var(--color-ia)',
  email: 'var(--color-gold)',
  voice: '#7c5cbf',
  whatsapp: '#25d366',
}

export default async function AnalyticsPage({ params, searchParams }: Props) {
  const { tenantId } = await params
  const { channel: channelParam } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const activeChannel = CHANNELS.find((c) => c.value === channelParam)?.value ?? 'all'

  const admin = createAdminClient()

  let topicsQuery = admin
    .from('conversation_topics')
    .select('topic, user_message, created_at, channel')
    .eq('theatre_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (activeChannel !== 'all') {
    topicsQuery = topicsQuery.eq('channel', activeChannel)
  }

  const [{ data: analytics }, { data: topics }] = await Promise.all([
    admin
      .from('analytics_daily')
      .select('date, total_conversations, total_messages, avg_messages_per_conversation')
      .eq('theatre_id', tenantId)
      .order('date', { ascending: false })
      .limit(30),
    topicsQuery,
  ])

  const normalizedTopics = normalizeTopics(topics ?? [])
  const topTopics = getTopTopics(normalizedTopics)
  const recentTopics = normalizedTopics.slice(0, 20)

  const channelCounts = getChannelCounts(topics ?? [])

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="section-label">Data</p>
        <h1>Temas e intención</h1>
        <p className="muted">Preguntas clasificadas, temas frecuentes y señales de intención detectadas.</p>
      </header>

      <div className="channel-tabs" role="tablist">
        {CHANNELS.map(({ value, label }) => {
          const count = value === 'all'
            ? Object.values(channelCounts).reduce((a, b) => a + b, 0)
            : (channelCounts[value] ?? 0)
          const href = value === 'all'
            ? `/${tenantId}/analytics`
            : `/${tenantId}/analytics?channel=${value}`
          const isActive = activeChannel === value
          const hasData = value === 'all' ? count > 0 : count > 0

          return (
            <Link
              key={value}
              href={href}
              role="tab"
              aria-selected={isActive}
              className={`channel-tab ${isActive ? 'channel-tab-active' : ''} ${!hasData && value !== 'all' ? 'channel-tab-empty' : ''}`}
            >
              {label}
              {count > 0 && <span className="channel-tab-count">{count}</span>}
            </Link>
          )
        })}
      </div>

      <section className="card stack">
        <h2>Temas más preguntados</h2>
        {topTopics.length === 0 ? (
          <p className="muted">Aún no hay temas clasificados.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tema</th>
                <th>Preguntas</th>
                <th>Peso</th>
              </tr>
            </thead>
            <tbody>
              {topTopics.map((item) => (
                <tr key={item.topic}>
                  <td style={{ textTransform: 'capitalize' }}>{item.topic}</td>
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

      <section className="card stack">
        <h2>Últimas preguntas clasificadas</h2>
        {recentTopics.length === 0 ? (
          <p className="muted">Sin preguntas clasificadas.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tema</th>
                <th>Pregunta</th>
                {activeChannel === 'all' && <th>Canal</th>}
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recentTopics.map((topic, index) => (
                <tr key={`${topic.created_at}-${index}`}>
                  <td style={{ textTransform: 'capitalize' }}>{topic.topic}</td>
                  <td>{topic.user_message ?? '-'}</td>
                  {activeChannel === 'all' && (
                    <td>
                      <span className="channel-badge" style={{ background: `color-mix(in srgb, ${CHANNEL_COLORS[topic.channel ?? 'web'] ?? CHANNEL_COLORS.web} 14%, transparent)`, color: CHANNEL_COLORS[topic.channel ?? 'web'] ?? CHANNEL_COLORS.web }}>
                        {CHANNEL_LABELS[topic.channel ?? 'web'] ?? topic.channel}
                      </span>
                    </td>
                  )}
                  <td>
                    {topic.created_at ? new Date(topic.created_at).toLocaleString('es-ES') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card stack">
        <h2>Resumen diario</h2>
        <pre className="ai-output">{JSON.stringify(analytics?.slice(0, 3), null, 2)}</pre>
      </section>
    </main>
  )
}

function normalizeTopics(topics: { topic: string | null; user_message: string | null; created_at: string | null; channel?: string | null }[]) {
  return topics.map((topic) => ({
    ...topic,
    topic: classifyConversationTopic(topic.topic ?? undefined, topic.user_message ?? undefined),
  }))
}

function getTopTopics(topics: { topic: string }[]) {
  const counts = new Map<string, number>()
  topics.forEach(({ topic }) => {
    if (!topic || topic === 'otro') return
    counts.set(topic, (counts.get(topic) ?? 0) + 1)
  })

  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0)

  return Array.from(counts.entries())
    .map(([topic, count]) => ({
      topic,
      count,
      percentage: total === 0 ? 0 : Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
}

function getChannelCounts(topics: { channel?: string | null }[]) {
  const counts: Record<string, number> = {}
  topics.forEach(({ channel }) => {
    const key = channel ?? 'web'
    counts[key] = (counts[key] ?? 0) + 1
  })
  return counts
}
