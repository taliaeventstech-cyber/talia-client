import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { DeleteConversationButton } from '../delete-button'

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
    <main className="page-shell">
      <Link className="back-link" href={`/${tenantId}/conversations`}>
        <ArrowLeft aria-hidden="true" size={14} strokeWidth={2} />
        <span>Volver a conversaciones</span>
      </Link>

      <header className="card stack">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="section-label">Conversation log</p>
            <h1>Conversación</h1>
          </div>
          <DeleteConversationButton tenantId={tenantId} conversationId={conversationId} />
        </div>
        <dl style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px 16px' }}>
          <dt>Session ID</dt>
          <dd className="mono">{conversation.session_id}</dd>
          <dt>Email</dt>
          <dd style={{ margin: 0 }}>{visitorEmail ?? '-'}</dd>
          <dt>Inicio</dt>
          <dd style={{ margin: 0 }}>{new Date(conversation.started_at).toLocaleString('es-ES')}</dd>
          <dt>Mensajes</dt>
          <dd style={{ margin: 0 }}>{conversation.message_count}</dd>
        </dl>
      </header>

      <section className="chat-log">
        {messages?.map((message) => (
          <article
            key={message.id}
            className={`card message-card ${message.role === 'assistant' ? 'message-card-assistant' : 'message-card-user'}`}
          >
            <div className="message-meta">
              <strong>{message.role === 'assistant' ? 'TALIA' : 'Usuario'}</strong>
              <time>
                {new Date(message.created_at).toLocaleString('es-ES')}
              </time>
            </div>
            <p style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
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
