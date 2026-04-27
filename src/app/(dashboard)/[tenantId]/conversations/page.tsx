import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 1100, margin: '0 auto' }}>
      <h1>Conversaciones</h1>
      <p>{conversations?.length ?? 0} conversaciones</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginTop: '1.5rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
            <th style={{ padding: '0.75rem 0.5rem' }}>Session ID</th>
            <th style={{ padding: '0.75rem 0.5rem' }}>Email</th>
            <th style={{ padding: '0.75rem 0.5rem' }}>Último mensaje</th>
            <th style={{ padding: '0.75rem 0.5rem' }}>Inicio</th>
            <th style={{ padding: '0.75rem 0.5rem' }}>Mensajes</th>
            <th style={{ padding: '0.75rem 0.5rem' }}></th>
          </tr>
        </thead>
        <tbody>
          {conversations?.map((conversation) => (
            <tr key={conversation.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {conversation.session_id.slice(0, 16)}...
              </td>
              <td style={{ padding: '0.75rem 0.5rem' }}>{getVisitorEmail(conversation.metadata) ?? '-'}</td>
              <td style={{ padding: '0.75rem 0.5rem', maxWidth: 360 }}>
                {truncate(latestMessageByConversation.get(conversation.id) ?? '-', 120)}
              </td>
              <td style={{ padding: '0.75rem 0.5rem' }}>{new Date(conversation.started_at).toLocaleString('es-ES')}</td>
              <td style={{ padding: '0.75rem 0.5rem' }}>{conversation.message_count}</td>
              <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                <Link href={`/${tenantId}/conversations/${conversation.id}`}>Ver mensajes</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
