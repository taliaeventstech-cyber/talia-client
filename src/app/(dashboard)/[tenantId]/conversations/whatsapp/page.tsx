import { LocalDateTime } from '@/components/local-date-time'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getIntlLocale } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/dictionaries'
import { getWhatsappHandoffCopy } from '@/lib/i18n/whatsapp-handoff-copy'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWhatsappHandoffQueue } from '@/lib/whatsapp/operator-handoff'
import { Eye } from 'lucide-react'
import Link from 'next/link'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function WhatsappHandoffQueuePage({ params }: Props) {
  const { tenantId } = await params
  const locale = await getLocale()
  const copy = getWhatsappHandoffCopy(locale)
  const access = await requireTenantProductAccess(tenantId, 'view_conversations', 'whatsapp')
  const queue = await getWhatsappHandoffQueue(createAdminClient(), {
    tenantId,
    actorUserId: access.userId,
  })

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="section-label">{copy.queue.eyebrow}</p>
        <h1>{copy.queue.title}</h1>
        <p className="muted">{copy.queue.description}</p>
      </header>

      <div className="channel-tabs" role="tablist">
        {access.modules.web === 'active' || access.modules.web === 'trial' ? (
          <Link aria-selected="false" className="channel-tab" href={`/${tenantId}/conversations`} role="tab">
            {copy.tabs.web}
          </Link>
        ) : null}
        <Link
          aria-selected="true"
          className="channel-tab channel-tab-active"
          href={`/${tenantId}/conversations/whatsapp`}
          role="tab"
        >
          {copy.tabs.whatsapp}
          <span className="channel-tab-count">{queue.count}</span>
        </Link>
      </div>

      <p className="muted">{copy.queue.pending(queue.count)}</p>

      {queue.items.length === 0 ? (
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
                <th>{copy.queue.assignedTo}</th>
                <th>{copy.queue.activity}</th>
                <th>{copy.queue.messages}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {queue.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.contact_name}</strong>
                    <span className="whatsapp-contact-mask">{item.contact_masked}</span>
                  </td>
                  <td className="whatsapp-message-preview">{item.latest_message ?? '—'}</td>
                  <td>{item.assigned_name ?? item.assigned_email ?? copy.queue.unassigned}</td>
                  <td>
                    <LocalDateTime value={item.last_message_at ?? item.created_at} locale={getIntlLocale(locale)} />
                  </td>
                  <td>{item.message_count}</td>
                  <td className="whatsapp-handoff-open-cell">
                    <Link
                      aria-label={copy.queue.view}
                      className="link-accent whatsapp-handoff-open-link"
                      href={`/${tenantId}/conversations/whatsapp/${item.id}`}
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
