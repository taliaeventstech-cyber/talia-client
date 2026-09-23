import {
  ConversationDetailHeader,
  ConversationMessageList,
} from '@/components/conversations/conversation-detail'
import { getConversationStatusTone } from '@/components/conversations/conversation-history'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { hasTenantPermission } from '@/lib/auth/permissions'
import { getIntlLocale } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/dictionaries'
import { getInstagramConversationCopy } from '@/lib/i18n/instagram-conversation-copy'
import { getInstagramConversationDetail } from '@/lib/instagram/conversations'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { InstagramOperatorControls } from './operator-controls'

interface Props {
  params: Promise<{ tenantId: string; conversationId: string }>
}

export default async function InstagramConversationDetailPage({ params }: Props) {
  const { tenantId, conversationId } = await params
  const locale = await getLocale()
  const copy = getInstagramConversationCopy(locale)
  const access = await requireTenantProductAccess(tenantId, 'view_conversations', 'instagram')
  const admin = createAdminClient()
  const [conversation, profileResult] = await Promise.all([
    getInstagramConversationDetail(admin, {
      tenantId,
      conversationId,
      actorUserId: access.userId,
    }),
    admin.from('profiles').select('id').eq('auth_user_id', access.userId).maybeSingle(),
  ])
  if (!conversation) notFound()

  const currentProfileId = profileResult.data?.id ?? null
  const assignedLabel = conversation.assigned_name ?? conversation.assigned_email ?? copy.detail.unassigned
  const canManage = hasTenantPermission(access.role, 'manage_conversations')
  const humanAgentUntil = conversation.human_agent_eligible_until

  return (
    <main className="page-shell whatsapp-handoff-detail-shell">
      <ConversationDetailHeader
        backHref={`/${tenantId}/instagram`}
        backLabel={copy.detail.back}
        eyebrow={copy.detail.eyebrow}
        title={copy.detail.title}
        metadata={[
          { label: copy.detail.contact, value: `Instagram · ${conversation.contact_masked}` },
          ...(conversation.status === 'handoff'
            ? [
                { label: copy.detail.assignedTo, value: assignedLabel },
                { label: copy.detail.reason, value: conversation.handoff_reason ?? '—' },
                ...(humanAgentUntil
                  ? [{
                      label: copy.detail.humanAgentUntil,
                      value: new Intl.DateTimeFormat(getIntlLocale(locale), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(humanAgentUntil)),
                    }]
                  : []),
              ]
            : []),
        ]}
      />

      {conversation.status === 'handoff' ? (
        <section className="card stack">
          <div>
            <h2>{copy.controls.title}</h2>
            <p>{copy.controls.description}</p>
          </div>
          <InstagramOperatorControls
            canManage={canManage}
            conversationId={conversationId}
            copy={copy.controls}
            isAssigned={conversation.assigned_profile_id !== null}
            isAssignedToCurrentUser={conversation.assigned_profile_id === currentProfileId}
            locale={locale}
            tenantId={tenantId}
            windowExpired={conversation.human_agent_window_expired}
          />
        </section>
      ) : null}

      <ConversationMessageList
        ariaLabel={copy.detail.title}
        locale={getIntlLocale(locale)}
        items={conversation.messages.map((message) => ({
          id: message.id,
          senderLabel: message.direction === 'inbound'
            ? copy.detail.user
            : message.is_operator_reply
              ? copy.detail.operator
              : copy.detail.talia,
          body: message.body_text ?? `[${copy.detail.unsupportedMessage}: ${message.message_type}]`,
          createdAt: message.created_at,
          isAssistant: message.direction === 'outbound',
          delivery: message.direction === 'outbound' && message.delivery_status
            ? {
                label: copy.detail.delivery[message.delivery_status] ?? message.delivery_status,
                tone: getConversationStatusTone(message.delivery_status),
              }
            : undefined,
        }))}
      />
    </main>
  )
}
