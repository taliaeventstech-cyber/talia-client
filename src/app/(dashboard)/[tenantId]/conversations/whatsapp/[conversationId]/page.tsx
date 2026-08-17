import { LocalDateTime } from '@/components/local-date-time'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { hasTenantPermission } from '@/lib/auth/permissions'
import { getIntlLocale } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/dictionaries'
import { getWhatsappHandoffCopy } from '@/lib/i18n/whatsapp-handoff-copy'
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

  return (
    <main className="page-shell whatsapp-handoff-detail-shell">
      <Link className="back-link" href={`/${tenantId}/conversations/whatsapp`}>
        <ArrowLeft aria-hidden="true" size={14} strokeWidth={2} />
        <span>{copy.detail.back}</span>
      </Link>

      <header className="card stack whatsapp-handoff-header">
        <div className="page-header">
          <p className="section-label">{copy.detail.eyebrow}</p>
          <h1>{copy.detail.title}</h1>
        </div>
        <dl className="whatsapp-handoff-metadata">
          <dt>{copy.detail.contact}</dt>
          <dd>{conversation.contact_name} · {conversation.contact_masked}</dd>
          <dt>{copy.detail.assignedTo}</dt>
          <dd>{assignedLabel}</dd>
          <dt>{copy.detail.reason}</dt>
          <dd>{conversation.handoff_reason ?? '—'}</dd>
        </dl>
      </header>

      <div className="whatsapp-handoff-detail-grid">
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

        <WhatsappOperatorControls
          canManage={canManage}
          conversationId={conversationId}
          copy={copy}
          isAssigned={conversation.assigned_profile_id !== null}
          isAssignedToCurrentUser={conversation.assigned_profile_id === currentProfileId}
          locale={locale}
          tenantId={tenantId}
        />
      </div>
    </main>
  )
}

function getDeliveryClass(status: string) {
  if (status === 'failed' || status === 'unknown') return 'status-pill-danger'
  if (status === 'read' || status === 'delivered') return 'status-pill-active'
  return 'status-pill-muted'
}
