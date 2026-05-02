import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MessagesSquare } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function ConversationsPage({ params }: Props) {
  const { tenantId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: conversations } = await admin
    .from('conversations')
    .select('id, session_id, started_at, message_count, metadata')
    .eq('theatre_id', tenantId)
    .order('started_at', { ascending: false })
    .limit(50)

  const conversationIds = conversations?.map((conversation) => conversation.id) ?? []
  const { data: latestMessages } = conversationIds.length
    ? await admin
      .from('messages')
      .select('conversation_id, content, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
    : { data: [] }

  const latestMessageByConversation = new Map<string, string>()
  latestMessages?.forEach((message) => {
    if (!latestMessageByConversation.has(message.conversation_id)) {
      latestMessageByConversation.set(message.conversation_id, message.content)
    }
  })

  return (
    <main className="page-shell">
      <header className="page-header">
        <h1>Conversaciones</h1>
        <p className="muted">{conversations?.length ?? 0} conversaciones</p>
      </header>

      <section className="card">
      <table className="data-table">
        <thead>
          <tr>
            <th>Session ID</th>
            <th>Email</th>
            <th>Último mensaje</th>
            <th>Inicio</th>
            <th>Mensajes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {conversations?.map((conversation) => (
            <tr key={conversation.id}>
              <td className="mono">
                {conversation.session_id.slice(0, 16)}...
              </td>
              <td>{getVisitorEmail(conversation.metadata) ?? '-'}</td>
              <td style={{ maxWidth: 360 }}>
                {truncate(latestMessageByConversation.get(conversation.id) ?? '-', 120)}
              </td>
              <td>{new Date(conversation.started_at).toLocaleString('es-ES')}</td>
              <td>{conversation.message_count}</td>
              <td style={{ textAlign: 'right' }}>
                <Link className="link-accent link-with-icon" href={`/${tenantId}/conversations/${conversation.id}`}>
                  <MessagesSquare aria-hidden="true" size={14} strokeWidth={2} />
                  Ver mensajes
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </section>
    </main>
  )
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

function getVisitorEmail(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return null
  const email = (metadata as { email?: unknown; visitor_email?: unknown }).email
    ?? (metadata as { email?: unknown; visitor_email?: unknown }).visitor_email
  return typeof email === 'string' && email ? email : null
}
