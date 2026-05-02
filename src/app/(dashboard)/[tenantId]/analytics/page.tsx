import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { classifyConversationTopic } from '@/lib/analytics/topics'
import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function AnalyticsPage({ params }: Props) {
  const { tenantId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: analytics }, { data: topics }] = await Promise.all([
    admin
      .from('analytics_daily')
      .select('date, total_conversations, total_messages, avg_messages_per_conversation')
      .eq('theatre_id', tenantId)
      .order('date', { ascending: false })
      .limit(30),
    admin
      .from('conversation_topics')
      .select('topic, user_message, created_at')
      .eq('theatre_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(500),
  ])
  const normalizedTopics = normalizeTopics(topics ?? [])
  const topTopics = getTopTopics(normalizedTopics)
  const recentTopics = normalizedTopics.slice(0, 20)

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="section-label">Data</p>
        <h1>Temas e intención</h1>
        <p className="muted">Preguntas clasificadas, temas frecuentes y señales de intención detectadas en el chatbot.</p>
      </header>

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
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recentTopics.map((topic, index) => (
                <tr key={`${topic.created_at}-${index}`}>
                  <td style={{ textTransform: 'capitalize' }}>{topic.topic}</td>
                  <td>{topic.user_message ?? '-'}</td>
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

function normalizeTopics(topics: { topic: string | null; user_message: string | null; created_at: string | null }[]) {
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
