import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const topTopics = getTopTopics(topics ?? [])
  const recentTopics = topics?.slice(0, 20) ?? []

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 1100, margin: '0 auto' }}>
      <h1>Analytics</h1>

      <section style={{ marginTop: '2rem' }}>
        <h2>Temas más preguntados</h2>
        {topTopics.length === 0 ? (
          <p style={{ color: '#999' }}>Aún no hay temas clasificados.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Tema</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Preguntas</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Peso</th>
              </tr>
            </thead>
            <tbody>
              {topTopics.map((item) => (
                <tr key={item.topic} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem 0.5rem', textTransform: 'capitalize' }}>{item.topic}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{item.count}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <div style={{ height: 10, background: '#eee', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${item.percentage}%`, height: '100%', background: '#111' }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: '2.5rem' }}>
        <h2>Últimas preguntas clasificadas</h2>
        {recentTopics.length === 0 ? (
          <p style={{ color: '#999' }}>Sin preguntas clasificadas.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Tema</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Pregunta</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recentTopics.map((topic, index) => (
                <tr key={`${topic.created_at}-${index}`} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem 0.5rem', textTransform: 'capitalize' }}>{topic.topic ?? '-'}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{topic.user_message ?? '-'}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {topic.created_at ? new Date(topic.created_at).toLocaleString('es-ES') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: '2.5rem' }}>
        <h2>Resumen diario</h2>
        <pre>{JSON.stringify(analytics?.slice(0, 3), null, 2)}</pre>
      </section>
    </main>
  )
}

function getTopTopics(topics: { topic: string | null }[]) {
  const counts = new Map<string, number>()
  topics.forEach(({ topic }) => {
    if (!topic) return
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
