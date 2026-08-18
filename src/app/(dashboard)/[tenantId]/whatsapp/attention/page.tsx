import { LocalDateTime } from '@/components/local-date-time'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { hasTenantPermission } from '@/lib/auth/permissions'
import { getIntlLocale } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/dictionaries'
import { getWhatsappHandoffCopy } from '@/lib/i18n/whatsapp-handoff-copy'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWhatsappHandoffDetail, getWhatsappHandoffQueue } from '@/lib/whatsapp/operator-handoff'
import { ArrowRight, UserRoundCheck } from 'lucide-react'
import Link from 'next/link'
import { WhatsappConversationThread } from '../../conversations/whatsapp/conversation-thread'

interface Props {
  params: Promise<{ tenantId: string }>
  searchParams: Promise<{ conversation?: string | string[] }>
}

export default async function WhatsappAttentionPage({ params, searchParams }: Props) {
  const [{ tenantId }, query] = await Promise.all([params, searchParams])
  const locale = await getLocale()
  const copy = getWhatsappHandoffCopy(locale)
  const access = await requireTenantProductAccess(tenantId, 'view_conversations', 'whatsapp')
  const admin = createAdminClient()
  const [queue, profileResult] = await Promise.all([
    getWhatsappHandoffQueue(admin, { tenantId, actorUserId: access.userId }),
    admin.from('profiles').select('id').eq('auth_user_id', access.userId).maybeSingle(),
  ])
  const requestedConversationId = typeof query.conversation === 'string' ? query.conversation : null
  const selectedConversationId = queue.items.some((item) => item.id === requestedConversationId)
    ? requestedConversationId
    : queue.items[0]?.id ?? null
  const conversation = selectedConversationId
    ? await getWhatsappHandoffDetail(admin, {
        tenantId,
        conversationId: selectedConversationId,
        actorUserId: access.userId,
      })
    : null

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="section-label">{copy.attention.eyebrow}</p>
          <h1>{copy.attention.title}</h1>
          <p className="muted">{copy.attention.description}</p>
        </div>
      </header>

      <p className="muted">{copy.attention.count(queue.count)}</p>

      {queue.items.length === 0 ? (
        <section className="card whatsapp-handoff-empty">
          <strong>{copy.attention.emptyTitle}</strong>
          <p className="muted">{copy.attention.emptyDescription}</p>
        </section>
      ) : (
        <div className="whatsapp-attention-workspace">
          <aside className="whatsapp-attention-queue" aria-label={copy.attention.title}>
            {queue.items.map((item) => {
              const assignedLabel = item.assigned_name ?? item.assigned_email ?? copy.attention.unassigned
              const isActive = item.id === selectedConversationId
              return (
                <Link
                  aria-current={isActive ? 'page' : undefined}
                  className={`card whatsapp-attention-item ${isActive ? 'whatsapp-attention-item-active' : ''}`}
                  href={`/${tenantId}/whatsapp/attention?conversation=${item.id}`}
                  key={item.id}
                >
                  <span className="whatsapp-attention-item-header">
                    <span>
                      <strong>{item.contact_name}</strong>
                      <span className="whatsapp-contact-mask">{item.contact_masked}</span>
                    </span>
                    <ArrowRight aria-hidden="true" size={15} strokeWidth={2} />
                  </span>
                  <span className="whatsapp-message-preview">{item.latest_message ?? '—'}</span>
                  <span className="whatsapp-attention-item-meta">
                    <span>
                      <UserRoundCheck aria-hidden="true" size={13} strokeWidth={2} />
                      {copy.attention.assignedTo}: {assignedLabel}
                    </span>
                    <LocalDateTime value={item.last_message_at ?? item.created_at} locale={getIntlLocale(locale)} />
                  </span>
                </Link>
              )
            })}
          </aside>

          {conversation ? (
            <section className="whatsapp-attention-conversation">
              <WhatsappConversationThread
                canManage={hasTenantPermission(access.role, 'manage_conversations')}
                conversation={conversation}
                copy={copy}
                currentProfileId={profileResult.data?.id ?? null}
                locale={locale}
                tenantId={tenantId}
              />
            </section>
          ) : null}
        </div>
      )}
    </main>
  )
}
