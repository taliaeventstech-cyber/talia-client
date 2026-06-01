import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { Eye } from 'lucide-react'
import Link from 'next/link'
import { DeleteConversationButton } from './delete-button'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function ConversationsPage({ params }: Props) {
  const { tenantId } = await params
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const access = await requireTenantProductAccess(tenantId, 'view_conversations', 'chatbot')

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
        <h1>{dictionary.conversations.title}</h1>
        <p className="muted">{dictionary.conversations.count(conversations?.length ?? 0)}</p>
      </header>

      <section className="card">
      <table className="data-table">
        <thead>
          <tr>
            <th>{dictionary.conversations.table.session}</th>
            <th>{dictionary.conversations.table.email}</th>
            <th>{dictionary.conversations.table.lastMessage}</th>
            <th>{dictionary.conversations.table.started}</th>
            <th>{dictionary.conversations.table.messages}</th>
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
              <td>{new Date(conversation.started_at).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES')}</td>
              <td>{conversation.message_count}</td>
              <td style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                <Link
                  className="link-accent"
                  aria-label={dictionary.conversations.viewMessages}
                  href={`/${tenantId}/conversations/${conversation.id}`}
                  style={{ display: 'grid', placeItems: 'center', padding: 4, borderRadius: 4 }}
                >
                  <Eye aria-hidden="true" size={14} strokeWidth={2} />
                </Link>
                {access.role === 'owner' || access.role === 'admin' ? (
                  <DeleteConversationButton tenantId={tenantId} conversationId={conversation.id} variant="icon" />
                ) : null}
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
