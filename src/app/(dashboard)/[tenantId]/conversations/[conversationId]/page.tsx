import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

interface Props {
  params: Promise<{ tenantId: string; conversationId: string }>
}

export default async function ConversationDetailPage({ params }: Props) {
  const { tenantId, conversationId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: conversation }, { data: messages }] = await Promise.all([
    admin
      .from('conversations')
      .select('id, session_id, started_at, ended_at, message_count, metadata')
      .eq('id', conversationId)
      .eq('theatre_id', tenantId)
      .single(),
    admin
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .eq('theatre_id', tenantId)
      .order('created_at', { ascending: true }),
  ])

  if (!conversation) notFound()

  const visitorEmail = getVisitorEmail(conversation.metadata)

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <Link href={`/${tenantId}/conversations`}>Volver a conversaciones</Link>

      <header style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>Conversación</h1>
        <dl style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '0.5rem 1rem', color: '#666' }}>
          <dt>Session ID</dt>
          <dd style={{ margin: 0, fontFamily: 'monospace' }}>{conversation.session_id}</dd>
          <dt>Email</dt>
          <dd style={{ margin: 0 }}>{visitorEmail ?? '-'}</dd>
          <dt>Inicio</dt>
          <dd style={{ margin: 0 }}>{new Date(conversation.started_at).toLocaleString('es-ES')}</dd>
          <dt>Mensajes</dt>
          <dd style={{ margin: 0 }}>{conversation.message_count}</dd>
        </dl>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages?.map((message) => (
          <article
            key={message.id}
            style={{
              border: '1px solid #eee',
              borderRadius: 8,
              padding: '1rem',
              marginLeft: message.role === 'assistant' ? '2rem' : 0,
              marginRight: message.role === 'user' ? '2rem' : 0,
              background: message.role === 'assistant' ? '#111' : '#f7f7f7',
              color: message.role === 'assistant' ? '#fff' : '#111',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
              <strong>{message.role === 'assistant' ? 'TALIA' : 'Usuario'}</strong>
              <time style={{ color: message.role === 'assistant' ? '#aaa' : '#666', fontSize: '0.85rem' }}>
                {new Date(message.created_at).toLocaleString('es-ES')}
              </time>
            </div>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{message.content}</p>
          </article>
        ))}
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
