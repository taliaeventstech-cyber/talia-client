import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { classifyConversationTopic } from '@/lib/analytics/topics'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface Props {
  params: Promise<{ tenantId: string }>
  searchParams: Promise<{ tab?: string }>
}

const TABS = [
  { value: 'intencion', label: 'Intención' },
  { value: 'temas', label: 'Temas' },
]

export default async function AnalyticsPage({ params, searchParams }: Props) {
  const { tenantId } = await params
  const { tab: tabParam } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const activeTab = TABS.find((t) => t.value === tabParam)?.value ?? 'intencion'

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
        <p className="section-label">Chatbot web</p>
        <h1>Análisis</h1>
        <p className="muted">Intenciones detectadas y temas frecuentes en las conversaciones del chatbot.</p>
      </header>

      <div className="channel-tabs" role="tablist">
        {TABS.map(({ value, label }) => {
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
          <h2>Intención por categoría</h2>
          <p className="muted">Distribución de lo que buscan los usuarios al contactar con el chatbot.</p>
          {topTopics.length === 0 ? (
            <p className="muted">Aún no hay datos suficientes.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Conversaciones</th>
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
      )}

      {activeTab === 'temas' && (
        <section className="card stack">
          <h2>Preguntas recientes</h2>
          <p className="muted">Últimas preguntas clasificadas por tema.</p>
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
                    <td>{topic.user_message ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {topic.created_at ? new Date(topic.created_at).toLocaleString('es-ES') : '—'}
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
