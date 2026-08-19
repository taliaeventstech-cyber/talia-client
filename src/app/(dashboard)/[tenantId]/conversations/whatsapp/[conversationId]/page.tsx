import { LocalDateTime } from '@/components/local-date-time'
import { MessageAttentionNavigator } from '@/components/message-attention-navigator'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { hasTenantPermission } from '@/lib/auth/permissions'
import { getIntlLocale } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/dictionaries'
import { getWhatsappHandoffCopy, getWhatsappOperatorControlsCopy } from '@/lib/i18n/whatsapp-handoff-copy'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWhatsappHandoffDetail } from '@/lib/whatsapp/operator-handoff'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { WhatsappOperatorControls } from '../operator-controls'

interface Props {
  params: Promise<{ tenantId: string; conversationId: string }>
}

export default async function WhatsappHandoffDetailPage({ params }: Props) {
  const { tenantId, conversationId } = await params
  const locale = await getLocale()
  const copy = getWhatsappHandoffCopy(locale)
  const controlsCopy = getWhatsappOperatorControlsCopy(locale)
  const access = await requireTenantProductAccess(tenantId, 'view_conversations', 'whatsapp')
  const admin = createAdminClient()
  const [conversation, profileResult] = await Promise.all([
    getWhatsappHandoffDetail(admin, { tenantId, conversationId, actorUserId: access.userId }),
    admin.from('profiles').select('id').eq('auth_user_id', access.userId).maybeSingle(),
  ])
  if (!conversation) notFound()

  const currentProfileId = profileResult.data?.id ?? null
  const assignedLabel = conversation.assigned_name ?? conversation.assigned_email ?? copy.detail.unassigned
  const canManage = conversation.status === 'handoff' && hasTenantPermission(access.role, 'manage_conversations')
  const attentionMessage = conversation.status === 'handoff'
    ? findCurrentAttentionMessage(conversation.messages)
    : null
  const attentionTargetId = attentionMessage ? `whatsapp-attention-${attentionMessage.id}` : null

  return (
    <main className="page-shell whatsapp-handoff-detail-shell">
      <Link className="back-link" href={`/${tenantId}/whatsapp`}>
        <ArrowLeft aria-hidden="true" size={14} strokeWidth={2} />
        <span>{copy.detail.back}</span>
      </Link>

      <header className="card stack whatsapp-handoff-header">
        <div className="page-header">
          <div>
            <p className="section-label">{copy.detail.eyebrow}</p>
            <h1>{copy.detail.title}</h1>
          </div>
        </div>
        <dl className="whatsapp-handoff-metadata">
          <dt>{copy.detail.contact}</dt>
          <dd>{conversation.contact_name} · {conversation.contact_masked}</dd>
          {conversation.status === 'handoff' ? (
            <>
              <dt>{copy.detail.assignedTo}</dt>
              <dd>{assignedLabel}</dd>
              <dt>{copy.detail.reason}</dt>
              <dd>{conversation.handoff_reason ?? '—'}</dd>
            </>
          ) : null}
        </dl>
      </header>

      {attentionTargetId ? (
        <MessageAttentionNavigator
          currentLabel={copy.navigator.attention}
          items={[{ targetId: attentionTargetId }]}
          next={copy.navigator.next}
          none={copy.navigator.none}
          position={copy.navigator.position}
          previous={copy.navigator.previous}
          statuses={[{ label: copy.navigator.pending, count: 1, tone: 'pending' }]}
          title={copy.navigator.title}
        />
      ) : null}

      <section className="chat-log" aria-label={copy.detail.title}>
        {conversation.messages.map((message) => {
          const label = message.direction === 'inbound'
            ? copy.detail.user
            : message.is_operator_reply
              ? copy.detail.operator
              : copy.detail.talia
          const needsAttention = message.id === attentionMessage?.id
          return (
            <article
              className={`card message-card ${message.direction === 'outbound' ? 'message-card-assistant' : 'message-card-user'}`}
              data-attention-target={needsAttention ? 'true' : undefined}
              id={needsAttention ? attentionTargetId ?? undefined : undefined}
              key={message.id}
            >
              <div className="message-meta">
                <strong>{label}</strong>
                <LocalDateTime value={message.created_at} locale={getIntlLocale(locale)} />
              </div>
              <p className="whatsapp-message-body">
                {message.body_text ?? `[${copy.detail.unsupportedMessage}: ${message.message_type}]`}
              </p>
              {message.direction === 'outbound' && message.delivery_status ? (
                <span className={`status-pill ${getDeliveryClass(message.delivery_status)}`}>
                  {copy.detail.delivery[message.delivery_status] ?? message.delivery_status}
                </span>
              ) : null}

              {needsAttention ? (
                <div className="whatsapp-message-attention">
                  <WhatsappOperatorControls
                    canManage={canManage}
                    conversationId={conversationId}
                    copy={controlsCopy}
                    isAssigned={conversation.assigned_profile_id !== null}
                    isAssignedToCurrentUser={conversation.assigned_profile_id === currentProfileId}
                    locale={locale}
                    tenantId={tenantId}
                  />
                </div>
              ) : null}
            </article>
          )
        })}
      </section>
    </main>
  )
}

function findCurrentAttentionMessage<T extends { direction: string; processing_status: string }>(messages: T[]) {
  return [...messages].reverse().find((message) => message.processing_status === 'handoff')
    ?? [...messages].reverse().find((message) => message.direction === 'inbound')
    ?? messages.at(-1)
    ?? null
}

function getDeliveryClass(status: string) {
  if (status === 'failed' || status === 'unknown') return 'status-pill-danger'
  if (status === 'read' || status === 'delivered') return 'status-pill-active'
  return 'status-pill-muted'
}
