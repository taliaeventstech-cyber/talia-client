import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { classifyConversationTopic } from '@/lib/analytics/topics'
import { MessagesSquare } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function OverviewPage({ params }: Props) {
  const { tenantId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: theatre }, { data: recentConversations }, { count: totalConversations }, { data: topics }] =
    await Promise.all([
      admin.from('theatres').select('name').eq('id', tenantId).single(),
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
        .from('conversation_topics')
        .select('topic, user_message')
        .eq('theatre_id', tenantId)
        .not('topic', 'is', null)
        .limit(500),
    ])
  const topTopics = getTopTopics(topics ?? [], 5)

  return (
    <main className="page-shell">
      <header className="page-header">
       
        <h1>{theatre?.name ?? 'Dashboard'}</h1>
        <p className="muted">Panel de control Talía</p>
      </header>

      <div className="kpi-row">
        <StatCard label="Total conversaciones" value={totalConversations ?? 0} />
      </div>

      <section className="card stack">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
          <h2>Temas más preguntados</h2>
          <Link className="link-accent" href={`/${tenantId}/analytics`}>Ver analytics</Link>
        </div>
        {topTopics.length === 0 ? (
          <p className="muted">Aún no hay temas clasificados.</p>
        ) : (
          <div className="stack">
            {topTopics.map((item) => (
              <TopicBar key={item.topic} topic={item.topic} count={item.count} max={topTopics[0].count} />
            ))}
          </div>
        )}
      </section>

      <section className="card stack">
      <h2>Últimas conversaciones</h2>
      {recentConversations?.length === 0 ? (
        <p className="muted">Sin conversaciones aún. Configura el nodo HTTP Request en n8n para empezar a recibir datos.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Session ID</th>
              <th>Email</th>
              <th>Inicio</th>
              <th>Mensajes</th>
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
                    Ver mensajes
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
