import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import {
  getConversationPageCount,
  getConversationPagination,
} from '@/lib/conversations/pagination'
import {
  getConversationReviewSummary,
  type ConversationReviewSummary,
} from '@/lib/chat/supervised-learning'
import { getDictionary, getLocale } from '@/lib/i18n/dictionaries'
import { getResponseFeedbackMetrics } from '@/lib/knowledge/response-feedback-metrics'
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DeleteConversationButton } from './delete-button'
import { ConversationPageSizeSelect } from './page-size-select'

interface Props {
  params: Promise<{ tenantId: string }>
  searchParams?: Promise<{
    page?: string | string[]
    page_size?: string | string[]
  }>
}

export default async function ConversationsPage({ params, searchParams }: Props) {
  const { tenantId } = await params
  const query = searchParams ? await searchParams : {}
  const pagination = getConversationPagination({
    page: getFirstSearchParam(query.page),
    pageSize: getFirstSearchParam(query.page_size),
  })
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const access = await requireTenantProductAccess(tenantId, 'view_conversations', 'chatbot')

  const admin = createAdminClient()

  const [
    conversationsResult,
    { count: totalResponses },
    { count: positiveResponses },
    { count: negativeResponses },
  ] = await Promise.all([
    admin
      .from('conversations')
      .select('id, session_id, started_at, last_message_at, message_count, metadata', { count: 'exact' })
      .eq('theatre_id', tenantId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('started_at', { ascending: false })
      .range(pagination.from, pagination.to),
    admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('theatre_id', tenantId)
      .eq('role', 'assistant'),
    admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('theatre_id', tenantId)
      .eq('role', 'assistant')
      .contains('metadata', { feedback: { rating: 'positive' } }),
    admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('theatre_id', tenantId)
      .eq('role', 'assistant')
      .contains('metadata', { feedback: { rating: 'negative' } }),
  ])
  const conversations = conversationsResult.data ?? []
  const totalConversations = conversationsResult.count ?? 0
  const pageCount = getConversationPageCount(totalConversations, pagination.pageSize)
  if (pagination.page > pageCount) {
    redirect(`/${tenantId}/conversations?page=${pageCount}&page_size=${pagination.pageSize}`)
  }
  const feedbackMetrics = getResponseFeedbackMetrics({
    positiveCount: positiveResponses ?? 0,
    negativeCount: negativeResponses ?? 0,
    totalCount: totalResponses ?? 0,
  })

  const conversationIds = conversations.map((conversation) => conversation.id)
  const { data: pageMessages } = conversationIds.length
    ? await admin
      .from('messages')
      .select('id, conversation_id, role, content, created_at, metadata')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
    : { data: [] }

  const latestMessageByConversation = new Map<string, string>()
  pageMessages?.forEach((message) => {
    if (!latestMessageByConversation.has(message.conversation_id)) {
      latestMessageByConversation.set(message.conversation_id, message.content)
    }
  })
  const assistantMessages = (pageMessages ?? []).filter((message) => message.role === 'assistant')
  const assistantMessageIds = assistantMessages.map((message) => message.id)
  const supervisedFaqResults = await Promise.all(
    chunkValues(assistantMessageIds, 100).map((messageIds) =>
      admin
        .from('knowledge_items')
        .select('id')
        .eq('theatre_id', tenantId)
        .in('id', messageIds),
    ),
  )
  const supervisedFaqIds = new Set(
    supervisedFaqResults.flatMap((result) => result.data ?? []).map((item) => item.id),
  )
  const assistantMessagesByConversation = new Map<string, typeof assistantMessages>()
  for (const message of assistantMessages) {
    const messages = assistantMessagesByConversation.get(message.conversation_id) ?? []
    messages.push(message)
    assistantMessagesByConversation.set(message.conversation_id, messages)
  }
  const reviewSummaryByConversation = new Map<string, ConversationReviewSummary>()
  for (const conversation of conversations) {
    reviewSummaryByConversation.set(
      conversation.id,
      getConversationReviewSummary(
        assistantMessagesByConversation.get(conversation.id) ?? [],
        supervisedFaqIds,
      ),
    )
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <h1>{dictionary.conversations.title}</h1>
        <p className="muted">{dictionary.conversations.count(totalConversations)}</p>
      </header>

      <ResponseAccuracySummary
        copy={dictionary.analytics.feedback}
        metrics={feedbackMetrics}
      />

      <section className="card stack">
        <table className="data-table">
          <thead>
            <tr>
              <th>{dictionary.conversations.table.session}</th>
              <th>{dictionary.conversations.table.email}</th>
              <th>{dictionary.conversations.table.lastMessage}</th>
              <th>{dictionary.conversations.table.started}</th>
              <th>{dictionary.conversations.table.messages}</th>
              <th>{dictionary.conversations.review.column}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((conversation) => (
              <tr key={conversation.id}>
                <td className="mono">
                  {conversation.session_id.slice(0, 16)}...
                </td>
                <td>{getVisitorEmail(conversation.metadata) ?? '-'}</td>
                <td style={{ maxWidth: 360 }}>
                  {truncate(latestMessageByConversation.get(conversation.id) ?? '-', 120)}
                </td>
                <td>
                  {new Date(conversation.last_message_at ?? conversation.started_at).toLocaleString(getDateLocale(locale))}
                </td>
                <td>{conversation.message_count}</td>
                <td>
                  <ConversationReviewStatus
                    tenantId={tenantId}
                    conversationId={conversation.id}
                    summary={reviewSummaryByConversation.get(conversation.id)}
                    copy={dictionary.conversations.review}
                  />
                </td>
                <td style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  <Link
                    className="link-accent"
                    aria-label={dictionary.conversations.viewMessages}
                    href={`/${tenantId}/conversations/${conversation.id}`}
                    style={{ display: 'grid', placeItems: 'center', padding: 4, borderRadius: 4 }}
                  >
                    <Eye aria-hidden="true" size={14} strokeWidth={2} />
                  </Link>
                  {access.role === 'owner' || access.role === 'admin' ? (
                    <DeleteConversationButton tenantId={tenantId} conversationId={conversation.id} variant="icon" />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ConversationPagination
          tenantId={tenantId}
          page={pagination.page}
          pageCount={pageCount}
          pageSize={pagination.pageSize}
          total={totalConversations}
          copy={dictionary.conversations.pagination}
        />
      </section>
    </main>
  )
}

function ConversationReviewStatus({
  tenantId,
  conversationId,
  summary,
  copy,
}: {
  tenantId: string
  conversationId: string
  summary: ConversationReviewSummary | undefined
  copy: {
    pendingImprovement: (count: number) => string
    corrected: (count: number) => string
    accepted: (count: number) => string
    openPending: string
    openCorrected: string
    openAccepted: string
  }
}) {
  if (!summary) return <span className="muted">—</span>
  const hasPending = summary.pendingNegativeCount > 0 || summary.pendingFallbackCount > 0
  const pendingImprovementCount = summary.pendingNegativeCount + summary.pendingFallbackCount
  if (!hasPending && summary.correctedCount === 0 && summary.acceptedCount === 0) {
    return <span className="muted">—</span>
  }

  const firstPendingMessageId = summary.firstPendingNegativeMessageId
    ?? summary.firstPendingFallbackMessageId
  const pendingHref = firstPendingMessageId
    ? `/${tenantId}/conversations/${conversationId}#response-${firstPendingMessageId}`
    : `/${tenantId}/conversations/${conversationId}`
  const correctedHref = summary.firstCorrectedMessageId
    ? `/${tenantId}/conversations/${conversationId}#response-${summary.firstCorrectedMessageId}`
    : `/${tenantId}/conversations/${conversationId}`
  const acceptedHref = summary.firstAcceptedMessageId
    ? `/${tenantId}/conversations/${conversationId}#response-${summary.firstAcceptedMessageId}`
    : `/${tenantId}/conversations/${conversationId}`

  return (
    <div className="conversation-review-statuses">
      {pendingImprovementCount > 0 ? (
        <Link
          className="conversation-review-badge conversation-review-badge-improvement"
          href={pendingHref}
          aria-label={copy.openPending}
        >
          {copy.pendingImprovement(pendingImprovementCount)}
        </Link>
      ) : null}
      {summary.correctedCount > 0 ? (
        <Link
          className="conversation-review-badge conversation-review-badge-corrected"
          href={correctedHref}
          aria-label={copy.openCorrected}
        >
          {copy.corrected(summary.correctedCount)}
        </Link>
      ) : null}
      {summary.acceptedCount > 0 ? (
        <Link
          className="conversation-review-badge conversation-review-badge-accepted"
          href={acceptedHref}
          aria-label={copy.openAccepted}
        >
          {copy.accepted(summary.acceptedCount)}
        </Link>
      ) : null}
    </div>
  )
}

function ResponseAccuracySummary({
  copy,
  metrics,
}: {
  copy: {
    section: string
    title: string
    description: string
    accuracy: string
    positive: string
    negative: string
    rated: string
    coverage: string
    coverageDetail: (rated: number, total: number) => string
    noData: string
    method: string
  }
  metrics: ReturnType<typeof getResponseFeedbackMetrics>
}) {
  return (
    <section className="card stack analytics-feedback-section" aria-labelledby="conversation-response-satisfaction-title">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">{copy.section}</p>
          <h2 id="conversation-response-satisfaction-title">{copy.title}</h2>
          <p className="muted">{copy.description}</p>
        </div>
        <div className="analytics-feedback-score">
          <span>{copy.accuracy}</span>
          <strong>{metrics.accuracyPercent === null ? copy.noData : `${metrics.accuracyPercent}%`}</strong>
        </div>
      </div>

      <div className="analytics-feedback-grid">
        <div>
          <span>{copy.positive}</span>
          <strong>{metrics.positiveCount}</strong>
        </div>
        <div>
          <span>{copy.negative}</span>
          <strong>{metrics.negativeCount}</strong>
        </div>
        <div>
          <span>{copy.rated}</span>
          <strong>{metrics.ratedCount}</strong>
        </div>
      </div>

      <div className="analytics-feedback-coverage">
        <div>
          <span>{copy.coverage}</span>
          <strong>{metrics.coveragePercent}%</strong>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label={copy.coverage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={metrics.coveragePercent}
        >
          <div className="progress-fill" style={{ width: `${metrics.coveragePercent}%` }} />
        </div>
        <small>{copy.coverageDetail(metrics.ratedCount, metrics.totalCount)}</small>
      </div>

      <p className="muted analytics-feedback-method">{copy.method}</p>
    </section>
  )
}

function ConversationPagination({
  tenantId,
  page,
  pageCount,
  pageSize,
  total,
  copy,
}: {
  tenantId: string
  page: number
  pageCount: number
  pageSize: number
  total: number
  copy: {
    label: string
    pageSize: string
    pageSizeAria: string
    summary: (from: number, to: number, total: number, page: number, pageCount: number) => string
    previous: string
    next: string
  }
}) {
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const hrefForPage = (targetPage: number) =>
    `/${tenantId}/conversations?page=${targetPage}&page_size=${pageSize}`

  return (
    <nav className="table-pagination" aria-label={copy.label}>
      <p>{copy.summary(from, to, total, page, pageCount)}</p>
      <div className="table-pagination-actions">
        <ConversationPageSizeSelect
          value={pageSize}
          label={copy.pageSize}
          ariaLabel={copy.pageSizeAria}
        />
        {page > 1 ? (
          <Link className="pagination-icon-button" href={hrefForPage(page - 1)} aria-label={copy.previous} scroll={false}>
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        ) : (
          <span className="pagination-icon-button button-disabled" aria-label={copy.previous}>
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          </span>
        )}
        {page < pageCount ? (
          <Link className="pagination-icon-button" href={hrefForPage(page + 1)} aria-label={copy.next} scroll={false}>
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        ) : (
          <span className="pagination-icon-button button-disabled" aria-label={copy.next}>
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  )
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

function getVisitorEmail(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return null
  const email = (metadata as { email?: unknown; visitor_email?: unknown }).email
    ?? (metadata as { email?: unknown; visitor_email?: unknown }).visitor_email
  return typeof email === 'string' && email ? email : null
}

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getDateLocale(locale: string) {
  if (locale === 'ca') return 'ca-ES'
  if (locale === 'en') return 'en-GB'
  return 'es-ES'
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}
