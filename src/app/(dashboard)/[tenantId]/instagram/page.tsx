import {
  ConversationHistory,
  getConversationStatusTone,
} from '@/components/conversations/conversation-history'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getIntlLocale } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/dictionaries'
import { getInstagramConversationCopy } from '@/lib/i18n/instagram-conversation-copy'
import { getInstagramConversationHistory } from '@/lib/instagram/conversations'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function InstagramConversationHistoryPage({ params }: Props) {
  const { tenantId } = await params
  const locale = await getLocale()
  const copy = getInstagramConversationCopy(locale)
  const access = await requireTenantProductAccess(tenantId, 'view_conversations', 'instagram')
  const history = await getInstagramConversationHistory(createAdminClient(), {
    tenantId,
    actorUserId: access.userId,
  })

  return (
    <main className="page-shell">
      <ConversationHistory
        eyebrow={copy.queue.eyebrow}
        title={copy.queue.title}
        description={copy.queue.description}
        countLabel={copy.queue.count(history.count)}
        emptyTitle={copy.queue.emptyTitle}
        emptyDescription={copy.queue.emptyDescription}
        labels={{
          identity: copy.queue.contact,
          latestMessage: copy.queue.latestMessage,
          status: copy.queue.status,
          activity: copy.queue.activity,
          messages: copy.queue.messages,
          view: copy.queue.view,
        }}
        locale={getIntlLocale(locale)}
        items={history.items.map((item) => ({
          id: item.id,
          identity: { primary: 'Instagram', secondary: item.contact_masked },
          latestMessage: item.latest_message,
          status: {
            label: copy.queue.statuses[item.status],
            tone: getConversationStatusTone(item.status),
          },
          activityAt: item.last_message_at ?? item.created_at,
          messageCount: item.message_count,
          href: `/${tenantId}/instagram/${item.id}`,
        }))}
      />
    </main>
  )
}
