import { LocalDateTime } from '@/components/local-date-time'
import { getIntlLocale, type Locale } from '@/lib/i18n/config'
import type { WhatsappHandoffCopy } from '@/lib/i18n/whatsapp-handoff-copy'
import type { WhatsappHandoffDetail } from '@/lib/whatsapp/operator-handoff'
import { WhatsappOperatorControls } from './operator-controls'

export function WhatsappConversationThread({
  tenantId,
  locale,
  conversation,
  currentProfileId,
  canManage,
  copy,
  headingLevel = 'h2',
}: {
  tenantId: string
  locale: Locale
  conversation: WhatsappHandoffDetail
  currentProfileId: string | null
  canManage: boolean
  copy: WhatsappHandoffCopy
  headingLevel?: 'h1' | 'h2'
}) {
  const assignedLabel = conversation.assigned_name ?? conversation.assigned_email ?? copy.detail.unassigned
  const Heading = headingLevel

  return (
    <div className="stack whatsapp-conversation-thread">
      <header className="card stack whatsapp-handoff-header">
        <div className="page-header">
          <div>
            <p className="section-label">{copy.detail.eyebrow}</p>
            <Heading>{copy.detail.title}</Heading>
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

      <div className={`whatsapp-handoff-detail-grid ${conversation.status === 'handoff' ? '' : 'whatsapp-handoff-detail-grid-single'}`}>
        <section className="chat-log" aria-label={copy.detail.title}>
          {conversation.messages.map((message) => {
            const label = message.direction === 'inbound'
              ? copy.detail.user
              : message.is_operator_reply
                ? copy.detail.operator
                : copy.detail.talia
            return (
              <article
                className={`card message-card ${message.direction === 'outbound' ? 'message-card-assistant' : 'message-card-user'}`}
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
              </article>
            )
          })}
        </section>

        {conversation.status === 'handoff' ? (
          <WhatsappOperatorControls
            canManage={canManage}
            conversationId={conversation.id}
            copy={copy.controls}
            isAssigned={conversation.assigned_profile_id !== null}
            isAssignedToCurrentUser={conversation.assigned_profile_id === currentProfileId}
            locale={locale}
            tenantId={tenantId}
          />
        ) : null}
      </div>
    </div>
  )
}

function getDeliveryClass(status: string) {
  if (status === 'failed' || status === 'unknown') return 'status-pill-danger'
  if (status === 'read' || status === 'delivered') return 'status-pill-active'
  return 'status-pill-muted'
}
