import { LocalDateTime } from '@/components/local-date-time'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getIntlLocale } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/dictionaries'
import { getWhatsappHandoffCopy } from '@/lib/i18n/whatsapp-handoff-copy'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWhatsappConversationHistory } from '@/lib/whatsapp/operator-handoff'
import { Eye } from 'lucide-react'
import Link from 'next/link'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function WhatsappConversationHistoryPage({ params }: Props) {
  const { tenantId } = await params
  const locale = await getLocale()
  const copy = getWhatsappHandoffCopy(locale)
  const access = await requireTenantProductAccess(tenantId, 'view_conversations', 'whatsapp')
  const history = await getWhatsappConversationHistory(createAdminClient(), {
    tenantId,
    actorUserId: access.userId,
  })

  return (
    <main className="page-shell">
      <header className="page-header whatsapp-conversations-header">
        <p className="section-label">{copy.queue.eyebrow}</p>
        <h1>{copy.queue.title}</h1>
        <p className="muted">{copy.queue.description}</p>
      </header>

      <p className="muted">{copy.queue.count(history.count)}</p>

      {history.items.length === 0 ? (
        <section className="card whatsapp-handoff-empty">
          <strong>{copy.queue.emptyTitle}</strong>
          <p className="muted">{copy.queue.emptyDescription}</p>
        </section>
      ) : (
        <section className="card whatsapp-handoff-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{copy.queue.contact}</th>
                <th>{copy.queue.latestMessage}</th>
                <th>{copy.queue.status}</th>
                <th>{copy.queue.activity}</th>
                <th>{copy.queue.messages}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.contact_name}</strong>
                    <span className="whatsapp-contact-mask">{item.contact_masked}</span>
                  </td>
                  <td className="whatsapp-message-preview">{item.latest_message ?? '—'}</td>
                  <td>
                    <span className={`status-pill ${getConversationStatusClass(item.status)}`}>
                      {copy.queue.statuses[item.status]}
                    </span>
                  </td>
                  <td>
                    <LocalDateTime value={item.last_message_at ?? item.created_at} locale={getIntlLocale(locale)} />
                  </td>
                  <td>{item.message_count}</td>
                  <td className="whatsapp-handoff-open-cell">
                    <Link
                      aria-label={copy.queue.view}
                      className="link-accent whatsapp-handoff-open-link"
                      href={`/${tenantId}/whatsapp/${item.id}`}
                    >
                      <Eye aria-hidden="true" size={15} strokeWidth={2} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}

function getConversationStatusClass(status: string) {
  if (status === 'handoff' || status === 'blocked') return 'status-pill-danger'
  if (status === 'open' || status === 'pending') return 'status-pill-active'
  return 'status-pill-muted'
}
