import { LocalDateTime } from '@/components/local-date-time'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ConversationStatusTone } from './conversation-history'

interface ConversationDetailHeaderProps {
  backHref: string
  backLabel: string
  eyebrow: string
  title: string
  metadata: Array<{
    label: string
    value: ReactNode
  }>
  actions?: ReactNode
}

export interface ConversationMessageItem {
  id: string
  senderLabel: string
  body: string
  createdAt: string
  isAssistant: boolean
  anchorId?: string
  needsAttention?: boolean
  delivery?: {
    label: string
    tone: ConversationStatusTone
  }
  extras?: ReactNode
}

interface ConversationMessageListProps {
  ariaLabel?: string
  items: ConversationMessageItem[]
  locale: string
}

export function ConversationDetailHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  metadata,
  actions,
}: ConversationDetailHeaderProps) {
  return (
    <>
      <Link className="back-link" href={backHref}>
        <ArrowLeft aria-hidden="true" size={14} strokeWidth={2} />
        <span>{backLabel}</span>
      </Link>

      <header className="card stack conversation-detail-header">
        <div className="page-header conversation-detail-heading">
          <div>
            <p className="section-label">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          {actions}
        </div>
        <dl className="conversation-detail-metadata">
          {metadata.map((item) => (
            <div className="conversation-detail-metadata-row" key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </header>
    </>
  )
}

export function ConversationMessageList({ ariaLabel, items, locale }: ConversationMessageListProps) {
  return (
    <section className="chat-log" aria-label={ariaLabel}>
      {items.map((message) => (
        <article
          className={`card message-card ${message.isAssistant ? 'message-card-assistant' : 'message-card-user'}`}
          data-attention-target={message.needsAttention ? 'true' : undefined}
          id={message.anchorId}
          key={message.id}
        >
          <div className="message-meta">
            <strong>{message.senderLabel}</strong>
            <LocalDateTime value={message.createdAt} locale={locale} />
          </div>
          <p className="conversation-message-body">{message.body}</p>
          {message.delivery ? (
            <span className={`status-pill status-pill-${message.delivery.tone}`}>
              {message.delivery.label}
            </span>
          ) : null}
          {message.extras}
        </article>
      ))}
    </section>
  )
}
