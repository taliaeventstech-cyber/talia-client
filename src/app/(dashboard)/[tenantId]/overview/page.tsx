import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

  const [{ data: theatre }, { data: recentConversations }, { count: totalConversations }] =
    await Promise.all([
      admin.from('theatres').select('name').eq('id', tenantId).single(),
      admin
        .from('conversations')
        .select('id, session_id, started_at, message_count')
        .eq('theatre_id', tenantId)
        .order('started_at', { ascending: false })
        .limit(5),
      admin
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('theatre_id', tenantId),
    ])

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ marginBottom: '0.25rem' }}>{theatre?.name ?? 'Dashboard'}</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>Panel de control TALIA</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Total conversaciones" value={totalConversations ?? 0} />
      </div>

      <h2 style={{ marginBottom: '1rem' }}>Últimas conversaciones</h2>
      {recentConversations?.length === 0 ? (
        <p style={{ color: '#999' }}>Sin conversaciones aún. Configura el nodo HTTP Request en n8n para empezar a recibir datos.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem' }}>Session ID</th>
              <th style={{ padding: '0.5rem' }}>Inicio</th>
              <th style={{ padding: '0.5rem' }}>Mensajes</th>
            </tr>
          </thead>
          <tbody>
            {recentConversations?.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.session_id.slice(0, 16)}...</td>
                <td style={{ padding: '0.5rem' }}>{new Date(c.started_at).toLocaleString('es-ES')}</td>
                <td style={{ padding: '0.5rem' }}>{c.message_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 8, padding: '1.25rem' }}>
      <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>{label}</p>
      <p style={{ margin: '0.5rem 0 0', fontSize: '2rem', fontWeight: 700 }}>{value}</p>
    </div>
  )
}
