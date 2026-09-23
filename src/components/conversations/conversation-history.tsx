import { LocalDateTime } from '@/components/local-date-time'
import { Eye } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export type ConversationStatusTone = 'active' | 'danger' | 'muted'

export interface ConversationHistoryItem {
  id: string
  identity: {
    primary: string
    secondary?: string | null
    mono?: boolean
  }
  latestMessage?: string | null
  status?: {
    label: string
    tone: ConversationStatusTone
  }
  statusContent?: ReactNode
  activityAt: string
  messageCount: number
  href: string
  actions?: ReactNode
}

interface ConversationHistoryProps {
  eyebrow?: string
  title: string
  description?: string
  countLabel: string
  emptyTitle: string
  emptyDescription: string
  labels: {
    identity: string
    latestMessage: string
    status: string
    activity: string
    messages: string
    view: string
  }
  items: ConversationHistoryItem[]
  locale: string
  beforeTable?: ReactNode
  afterTable?: ReactNode
}

export function ConversationHistory({
  eyebrow,
  title,
  description,
  countLabel,
  emptyTitle,
  emptyDescription,
  labels,
  items,
  locale,
  beforeTable,
  afterTable,
}: ConversationHistoryProps) {
  return (
    <>
      <header className="page-header conversation-history-header">
        {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="muted">{description}</p> : null}
      </header>

      <p className="muted">{countLabel}</p>
      {beforeTable}

      {items.length === 0 ? (
        <section className="card conversation-history-empty">
          <strong>{emptyTitle}</strong>
          <p className="muted">{emptyDescription}</p>
        </section>
      ) : (
        <section className="card stack conversation-history-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{labels.identity}</th>
                <th>{labels.latestMessage}</th>
                <th>{labels.status}</th>
                <th>{labels.activity}</th>
                <th>{labels.messages}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong className={item.identity.mono ? 'mono' : undefined}>
                      {item.identity.primary}
                    </strong>
                    {item.identity.secondary ? (
                      <span className="conversation-history-identity-secondary">
                        {item.identity.secondary}
                      </span>
                    ) : null}
                  </td>
                  <td className="conversation-history-message-preview">{item.latestMessage ?? '—'}</td>
                  <td>
                    {item.statusContent ?? (item.status ? (
                      <span className={`status-pill status-pill-${item.status.tone}`}>
                        {item.status.label}
                      </span>
                    ) : <span className="muted">—</span>)}
                  </td>
                  <td><LocalDateTime value={item.activityAt} locale={locale} /></td>
                  <td>{item.messageCount}</td>
                  <td className="conversation-history-actions">
                    <Link
                      aria-label={labels.view}
                      className="link-accent conversation-history-open-link"
                      href={item.href}
                    >
                      <Eye aria-hidden="true" size={15} strokeWidth={2} />
                    </Link>
                    {item.actions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {afterTable}
        </section>
      )}
    </>
  )
}

export function getConversationStatusTone(status: string): ConversationStatusTone {
  if (status === 'handoff' || status === 'blocked' || status === 'failed' || status === 'unknown') {
    return 'danger'
  }
  if (status === 'open' || status === 'pending' || status === 'read' || status === 'delivered') {
    return 'active'
  }
  return 'muted'
}
