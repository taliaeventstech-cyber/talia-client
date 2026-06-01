import { requireTenantProductAccess } from '@/lib/auth/tenant-access'
import { getDictionary, getLocale, type Dictionary } from '@/lib/i18n/dictionaries'
import { createAdminClient } from '@/lib/supabase/admin'
import { QueryToastNotice } from '@/components/ui/query-toast-notice'
import { SelectAllCheckbox } from '@/components/ui/select-all-checkbox'
import { ChevronLeft, ChevronRight, Clock3, ExternalLink, Mail, PencilLine } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import {
  deleteSelectedEmailDraftsAction,
  deleteSelectedEmailThreadsAction,
  disconnectGoogleEmailAction,
  processSelectedEmailThreadsAction,
  syncLatestEmailAction,
} from './actions'
import { DraftDeleteChoiceButton } from './draft-delete-choice-button'
import { ProcessEmailSubmitButton } from './process-email-submit-button'
import { SelectedDeleteSubmitButton } from './selected-delete-submit-button'
import { SyncEmailSubmitButton } from './sync-email-submit-button'
import { ThreadPageSizeSelect } from './thread-page-size-select'

interface Props {
  params: Promise<{ tenantId: string }>
  searchParams?: Promise<{
    email_connected?: string
    email_disconnected?: string
    email_error?: string
    email_processed?: string
    email_process_error?: string
    email_synced?: string
    email_sync_error?: string
    email_auto_processed?: string
    email_selected_processed?: string
    email_selected_ignored?: string
    email_selected_failed?: string
    email_deleted?: string
    email_delete_error?: string
    email_draft_deleted?: string
    email_drafts_deleted?: string
    email_provider_drafts_deleted?: string
    email_provider_drafts_failed?: string
    email_draft_delete_error?: string
    thread_page?: string
    thread_limit?: string
    thread_status?: string
  }>
}

type ThreadStatusFilter = 'all' | 'new' | 'drafted' | 'waiting_human' | 'ignored'
type EmailCopy = Dictionary['email']

export default async function EmailAgentPage({ params, searchParams }: Props) {
  const { tenantId } = await params
  const query = searchParams ? await searchParams : {}
  await requireTenantProductAccess(tenantId, 'manage_email', 'email')
  const locale = await getLocale()
  const dictionary = await getDictionary(locale)
  const copy = dictionary.email

  const admin = createAdminClient()
  const threadPagination = getThreadPagination(query)
  const activeThreadStatus = getThreadStatusFilter(query.thread_status)
  const [
    { data: theatre },
    { data: connections },
    { count: threadTotalCount },
    { data: threadStatusRows },
    { data: drafts },
    { data: latestDrafts },
  ] = await Promise.all([
    admin
      .from('theatres')
      .select('name, fallback_email')
      .eq('id', tenantId)
      .single(),
    admin
      .from('email_connections')
      .select('id, provider, mailbox_email, status, draft_mode, sync_mode, last_synced_at, error_message')
      .eq('theatre_id', tenantId)
      .order('created_at', { ascending: false }),
    admin
      .from('email_threads')
      .select('id', { count: 'exact', head: true })
      .eq('theatre_id', tenantId),
    admin
      .from('email_threads')
      .select('id, status')
      .eq('theatre_id', tenantId),
    admin
      .from('email_drafts')
      .select('id, status, thread_id')
      .eq('theatre_id', tenantId),
    admin
      .from('email_drafts')
      .select(`
        id,
        status,
        provider_draft_id,
        generated_subject,
        generated_body_text,
        error_message,
        created_at,
        updated_at,
        email_threads(
          subject,
          sender_email,
          topic,
          priority,
          status
        )
      `)
      .eq('theatre_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(8),
  ])
  const threadTotal = threadTotalCount ?? 0
  const draftedThreadIds = new Set((drafts ?? []).map((draft) => draft.thread_id).filter(Boolean))
  const threadStatusCounts = countDisplayThreadStatuses(threadStatusRows ?? [], draftedThreadIds)
  const filteredThreadCount = activeThreadStatus === 'all'
    ? threadTotal
    : threadStatusCounts.get(activeThreadStatus) ?? 0
  const threadPageCount = Math.max(1, Math.ceil(filteredThreadCount / threadPagination.limit))
  const threadPage = Math.min(threadPagination.page, threadPageCount)
  const threadFrom = (threadPage - 1) * threadPagination.limit
  const threadTo = threadFrom + threadPagination.limit - 1
  let threadsQuery = admin
    .from('email_threads')
    .select('id, status, priority, subject, sender_email, topic, last_message_at, metadata')
    .eq('theatre_id', tenantId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .range(threadFrom, threadTo)

  if (activeThreadStatus === 'drafted') {
    const draftedIds = Array.from(draftedThreadIds)
    threadsQuery = draftedIds.length
      ? threadsQuery.eq('status', 'drafted').in('id', draftedIds)
      : threadsQuery.eq('id', '00000000-0000-0000-0000-000000000000')
  } else if (activeThreadStatus !== 'all') {
    threadsQuery = threadsQuery.eq('status', activeThreadStatus)
  }

  const { data: threads } = await threadsQuery
  const visibleThreadsWithDrafts = draftedThreadIds

  const connection = connections?.[0] ?? null
  const activeMailbox = connection?.mailbox_email ?? theatre?.fallback_email ?? copy.mailboxFallback
  const isConnected = connection?.status === 'connected' || connection?.status === 'syncing'
  const isError = connection?.status === 'error'
  const activeProvider = isConnected ? connection?.provider : undefined
  const hasOAuthSuccess = query.email_connected === '1'
  const hasDisconnectSuccess = query.email_disconnected === '1'
  const processSuccessMessage = getProcessSuccessMessage(copy, query.email_processed)
  const selectedProcessMessage = getSelectedProcessMessage(copy, {
    processed: query.email_selected_processed,
    ignored: query.email_selected_ignored,
    failed: query.email_selected_failed,
  })
  const syncSuccessMessage = getSyncSuccessMessage(copy, query.email_synced, query.email_auto_processed)
  const deleteSuccessMessage = getDeleteSuccessMessage(copy, query.email_deleted)
  const draftDeleteSuccessMessage = getDraftDeleteSuccessMessage(
    copy,
    query.email_draft_deleted,
    {
      deleted: query.email_drafts_deleted,
      providerDeleted: query.email_provider_drafts_deleted,
      providerFailed: query.email_provider_drafts_failed,
    },
  )
  const oauthErrorMessage = getOAuthErrorMessage(copy, query.email_error)
  const processErrorMessage = query.email_process_error
  const syncErrorMessage = query.email_sync_error
  const deleteErrorMessage = query.email_delete_error
  const draftDeleteErrorMessage = query.email_draft_delete_error
  const successToast = hasOAuthSuccess
    ? copy.toasts.connected
    : hasDisconnectSuccess
      ? copy.toasts.disconnected
      : selectedProcessMessage ?? syncSuccessMessage ?? deleteSuccessMessage ?? draftDeleteSuccessMessage ?? processSuccessMessage
  const errorToast = oauthErrorMessage
    ?? (processErrorMessage ? copy.toasts.processError(processErrorMessage) : null)
    ?? (syncErrorMessage ? copy.toasts.syncError(syncErrorMessage) : null)
    ?? (deleteErrorMessage ? copy.toasts.deleteError(deleteErrorMessage) : null)
    ?? (draftDeleteErrorMessage ? copy.toasts.draftDeleteError(draftDeleteErrorMessage) : null)
  const disconnectAction = disconnectGoogleEmailAction.bind(null, tenantId)
  const processSelectedAction = processSelectedEmailThreadsAction.bind(null, tenantId)
  const deleteSelectedAction = deleteSelectedEmailThreadsAction.bind(null, tenantId)
  const deleteSelectedDraftsAction = deleteSelectedEmailDraftsAction.bind(null, tenantId)
  const syncAction = syncLatestEmailAction.bind(null, tenantId)

  return (
    <main className="page-shell">
      {successToast ? <QueryToastNotice message={successToast} tone="success" clearParamPrefix="email_" /> : null}
      {errorToast ? <QueryToastNotice message={errorToast} tone="error" clearParamPrefix="email_" /> : null}

      <header className="page-header">
        <div>
          <p className="section-label">{copy.section}</p>
          <div className="page-title-row">
            <h1>{theatre?.name ?? 'Email'}</h1>
            <span className={`status-pill ${getConnectionStatusClass(connection?.status)}`}>
              {formatConnectionStatus(copy, connection?.status)}
            </span>
            <div className="email-header-mailbox">
              <span className="detail-icon" aria-hidden="true">
                <Mail size={16} strokeWidth={2} />
              </span>
              <div>
                <strong>{activeMailbox}</strong>
                <p>
                  {formatProvider(copy, activeProvider)} · {formatDraftMode(copy, connection?.draft_mode)} · {formatSync(copy, locale, connection?.sync_mode, connection?.last_synced_at)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {isError || connection?.error_message ? (
        <p className="notice notice-error">
          {connection?.error_message ?? copy.connectionError}
        </p>
      ) : null}

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">{copy.inbox.eyebrow}</p>
            <h2>{copy.inbox.title}</h2>
          </div>
          <Suspense fallback={<PageSizeSelectFallback ariaLabel={copy.inbox.pageSizeAria} label={copy.inbox.pageSize} value={threadPagination.limit} />}>
            <ThreadPageSizeSelect ariaLabel={copy.inbox.pageSizeAria} label={copy.inbox.pageSize} value={threadPagination.limit} />
          </Suspense>
        </div>

        <div className="email-action-strip">
          <div className="email-action-buttons">
            {isConnected ? (
              <form action={syncAction}>
                <SyncEmailSubmitButton label={copy.inbox.sync} syncingLabel={copy.inbox.syncing} />
              </form>
            ) : null}
            {isConnected ? (
              <a className="button-outline button-fit" href={getProviderConnectUrl(tenantId, connection.provider)}>
                {copy.header.reconnect}
              </a>
            ) : (
              <div className="email-provider-connectors" aria-label={copy.header.connectMailbox}>
                <a className="button-outline button-fit" href={getProviderConnectUrl(tenantId, 'google')}>
                  <GoogleProviderIcon />
                  {copy.header.connectGmail}
                </a>
                <a className="button-outline button-fit" href={getProviderConnectUrl(tenantId, 'microsoft')}>
                  <MicrosoftProviderIcon />
                  {copy.header.connectOutlook}
                </a>
              </div>
            )}
            {isConnected ? (
              <form action={disconnectAction}>
                <button className="button-outline button-danger button-fit" type="submit">
                  {copy.header.disconnect}
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <ThreadStatusFilters
          activeStatus={activeThreadStatus}
          counts={threadStatusCounts}
          labels={copy.inbox.filters}
          limit={threadPagination.limit}
          tenantId={tenantId}
          total={threadTotal}
        />

        {(threads ?? []).length ? (
          <form className="email-thread-selection" action={processSelectedAction}>
            <div className="email-thread-toolbar">
              <div className="email-thread-toolbar-main">
                <ProcessEmailSubmitButton label={copy.inbox.process} processingLabel={copy.inbox.processing} />
              </div>
              <div className="email-thread-toolbar-aside">
                <SelectedDeleteSubmitButton
                  formAction={deleteSelectedAction}
                  labels={{
                    cancel: copy.inbox.cancel,
                    confirm: copy.inbox.delete,
                    delete: copy.inbox.delete,
                    deleting: copy.inbox.deleting,
                    question: copy.inbox.deleteConfirm,
                    yes: copy.inbox.yes,
                  }}
                  targetName="thread_ids"
                />
              </div>
            </div>

            <table className="data-table email-thread-table">
              <thead>
                <tr>
                  <th className="email-select-cell">
                    <SelectAllCheckbox label={copy.inbox.selectAllThreads} targetName="thread_ids" />
                  </th>
                  <th>{copy.inbox.table.subject}</th>
                  <th>{copy.inbox.table.sender}</th>
                  <th>{copy.inbox.table.status}</th>
                  <th>{copy.inbox.table.topic}</th>
                </tr>
              </thead>
              <tbody>
                {(threads ?? []).map((thread) => (
                  <tr key={thread.id}>
                    <td className="email-select-cell">
                      <input
                        aria-label={copy.inbox.selectThread(thread.subject ?? copy.fallbackValues.noSubject)}
                        name="thread_ids"
                        type="checkbox"
                        value={thread.id}
                      />
                    </td>
                    <td>
                      <div className="email-thread-subject">
                        <strong>{thread.subject ?? copy.fallbackValues.noSubject}</strong>
                        <span>{getThreadInsight(copy, thread.metadata)}</span>
                      </div>
                    </td>
                    <td><span className="email-thread-sender">{thread.sender_email ?? copy.fallbackValues.noSender}</span></td>
                    <td>
                      <span className={`status-pill ${getThreadStatusClass(getDisplayThreadStatus(thread.status, thread.id, visibleThreadsWithDrafts))}`}>
                        {formatThreadStatus(copy, getDisplayThreadStatus(thread.status, thread.id, visibleThreadsWithDrafts))}
                      </span>
                    </td>
                    <td>
                      <div className="email-thread-topic">
                        <span>{formatTopic(copy, thread.topic)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination
              hrefForPage={(page) => getThreadPageHref(tenantId, { page, limit: threadPagination.limit, status: activeThreadStatus })}
              labels={copy.inbox.pagination}
              page={threadPage}
              pageCount={threadPageCount}
              total={filteredThreadCount}
            />
          </form>
        ) : (
          <div className="empty-state">
            <Clock3 size={18} aria-hidden="true" />
            <div>
            <strong>{copy.inbox.emptyTitle}</strong>
            <p className="muted">
                {copy.inbox.emptyDescription}
            </p>
            </div>
          </div>
        )}
      </section>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">{copy.drafts.eyebrow}</p>
            <h2>{copy.drafts.title}</h2>
          </div>
          {connection?.mailbox_email ? (
            <a className="button-outline button-fit" href={getProviderDraftsUrl(connection.provider, connection.mailbox_email)} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} strokeWidth={2} aria-hidden="true" />
              {copy.drafts.openMailbox}
            </a>
          ) : null}
        </div>

        {(latestDrafts ?? []).length ? (
          <form className="email-draft-selection" action={deleteSelectedDraftsAction}>
            <div className="email-thread-toolbar">
              <div className="email-thread-toolbar-main">
                <label className="bulk-select-row">
                  <SelectAllCheckbox label={copy.drafts.selectAllDrafts} targetName="draft_ids" />
                  {copy.drafts.selectAll}
                </label>
              </div>
              <div className="email-thread-toolbar-aside">
                <DraftDeleteChoiceButton
                  label={copy.drafts.delete}
                  labels={{
                    cancel: copy.drafts.cancel,
                    deleting: copy.drafts.deleting,
                    deletingAgora: copy.drafts.deletingAgora,
                    no: copy.drafts.no,
                    question: copy.drafts.deleteInMailboxQuestion,
                    yes: copy.drafts.yes,
                  }}
                  requireSelectionName="draft_ids"
                />
              </div>
            </div>

            <div className="email-draft-list">
            {(latestDrafts ?? []).map((draft) => {
              const thread = Array.isArray(draft.email_threads)
                ? draft.email_threads[0]
                : draft.email_threads

              return (
                <article className="email-draft-item" key={draft.id}>
                  <div className="email-draft-main">
                    <input
                      aria-label={copy.drafts.selectDraft(draft.generated_subject ?? thread?.subject ?? copy.fallbackValues.noSubject)}
                      className="email-draft-checkbox"
                      name="draft_ids"
                      type="checkbox"
                      value={draft.id}
                    />
                    {draft.status === 'created_in_provider' ? null : (
                      <span className={`status-pill ${getDraftStatusClass(draft.status)}`}>
                        {formatDraftStatus(copy, draft.status)}
                      </span>
                    )}
                    <div>
                      <strong>{draft.generated_subject ?? thread?.subject ?? copy.fallbackValues.noSubject}</strong>
                      <p className="muted">
                        {thread?.sender_email ?? copy.drafts.unknownSender} · {formatTopic(copy, thread?.topic)}
                      </p>
                    </div>
                  </div>
                  <div className="email-draft-meta">
                    <span>{formatDateTime(draft.updated_at ?? draft.created_at)}</span>
                    {draft.error_message ? (
                      <span className="email-error-text">{draft.error_message}</span>
                    ) : null}
                  </div>
                </article>
              )
            })}
            </div>
          </form>
        ) : (
          <div className="empty-state">
            <PencilLine size={18} aria-hidden="true" />
            <div>
            <strong>{copy.drafts.emptyTitle}</strong>
              <p className="muted">{copy.drafts.emptyDescription}</p>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

function getThreadPagination(query: { thread_page?: string; thread_limit?: string }) {
  const parsedPage = Number(query.thread_page ?? 1)
  const parsedLimit = Number(query.thread_limit ?? 15)
  const limit = [15, 25, 50].includes(parsedLimit) ? parsedLimit : 15
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1

  return { page, limit }
}

function getThreadStatusFilter(value?: string) {
  return getThreadStatusFilters().some((filter) => filter.value === value) ? value as ThreadStatusFilter : 'all'
}

function getThreadStatusFilters() {
  return [
    { value: 'all' },
    { value: 'new' },
    { value: 'drafted' },
    { value: 'waiting_human' },
    { value: 'ignored' },
  ] satisfies Array<{ value: ThreadStatusFilter }>
}

function getThreadPageHref(tenantId: string, input: { page: number; limit: number; status: string }) {
  const params = new URLSearchParams()
  params.set('thread_page', String(input.page))
  params.set('thread_limit', String(input.limit))
  if (input.status !== 'all') params.set('thread_status', input.status)

  return `/${tenantId}/email?${params.toString()}`
}

function getThreadFilterHref(tenantId: string, input: { status: string; limit: number }) {
  const params = new URLSearchParams()
  params.set('thread_page', '1')
  params.set('thread_limit', String(input.limit))
  if (input.status !== 'all') params.set('thread_status', input.status)

  return `/${tenantId}/email?${params.toString()}`
}

function ThreadStatusFilters({
  activeStatus,
  counts,
  labels,
  limit,
  tenantId,
  total,
}: {
  activeStatus: string
  counts: Map<string, number>
  labels: EmailCopy['inbox']['filters']
  limit: number
  tenantId: string
  total: number
}) {
  return (
    <nav className="email-thread-filters" aria-label={labels.all}>
      {getThreadStatusFilters().map((filter) => {
        const count = filter.value === 'all' ? total : counts.get(filter.value) ?? 0
        const active = activeStatus === filter.value

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={`email-thread-filter ${active ? 'email-thread-filter-active' : ''}`}
            href={getThreadFilterHref(tenantId, { status: filter.value, limit })}
            key={filter.value}
            scroll={false}
          >
            <span>{labels[filter.value]}</span>
            <strong>{count}</strong>
          </Link>
        )
      })}
    </nav>
  )
}

function PageSizeSelectFallback({ ariaLabel, label, value }: { ariaLabel: string; label: string; value: number }) {
  return (
    <label className="table-page-size">
      <span>{label}</span>
      <span className="table-page-size-select">
        <select aria-label={ariaLabel} defaultValue={value}>
          <option value="15">15</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </select>
      </span>
    </label>
  )
}

function TablePagination({
  hrefForPage,
  labels,
  page,
  pageCount,
  total,
}: {
  hrefForPage: (page: number) => string
  labels: EmailCopy['inbox']['pagination']
  page: number
  pageCount: number
  total: number
}) {
  if (total === 0) return null

  return (
    <nav className="table-pagination" aria-label={labels.label}>
      <p>{labels.page(page, pageCount)}</p>
      <div className="table-pagination-actions">
        {page > 1 ? (
          <Link className="pagination-icon-button" href={hrefForPage(page - 1)} aria-label={labels.previous} scroll={false}>
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        ) : (
          <span className="pagination-icon-button button-disabled" aria-label={labels.previous}>
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          </span>
        )}
        {page < pageCount ? (
          <Link className="pagination-icon-button" href={hrefForPage(page + 1)} aria-label={labels.next} scroll={false}>
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        ) : (
          <span className="pagination-icon-button button-disabled" aria-label={labels.next}>
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  )
}

function countDisplayThreadStatuses(items: { id: string; status: string }[], threadsWithDrafts: Set<string>) {
  return items.reduce((map, item) => {
    const status = getDisplayThreadStatus(item.status, item.id, threadsWithDrafts)
    map.set(status, (map.get(status) ?? 0) + 1)
    return map
  }, new Map<string, number>())
}

function getConnectionStatusClass(status?: string) {
  if (status === 'connected' || status === 'syncing') return 'status-pill-active'
  if (status === 'error' || status === 'revoked') return 'status-pill-danger'
  if (status === 'disabled') return 'status-pill-muted'
  return 'status-pill-soon'
}

function formatConnectionStatus(copy: EmailCopy, status?: string) {
  if (status === 'connected') return copy.statuses.connected
  if (status === 'syncing') return copy.statuses.syncing
  if (status === 'error') return copy.statuses.error
  if (status === 'revoked') return copy.statuses.revoked
  if (status === 'disabled') return copy.statuses.disabled
  return copy.statuses.pending
}

function getOAuthErrorMessage(copy: EmailCopy, error?: string) {
  if (!error) return null
  if (error === 'oauth_config') return copy.toasts.oauthConfig
  if (error === 'oauth_callback') return copy.toasts.oauthCallback
  if (error === 'missing_code') return copy.toasts.missingCode
  if (error === 'access_denied') return copy.toasts.accessDenied
  if (error === 'no_connection') return copy.toasts.noConnection
  if (error === 'disconnect_failed') return copy.toasts.disconnectFailed

  return copy.toasts.connectFailed(error)
}

function getProcessSuccessMessage(copy: EmailCopy, action?: string) {
  if (action === 'provider_draft_created') return copy.toasts.providerDraftCreated
  if (action === 'draft_generated') return copy.toasts.draftGenerated
  if (action === 'ignored') return copy.toasts.ignored
  return null
}

function getSelectedProcessMessage(copy: EmailCopy, input: { processed?: string; ignored?: string; failed?: string }) {
  if (input.processed === undefined && input.ignored === undefined && input.failed === undefined) return null
  const processed = Number(input.processed ?? 0)
  const ignored = Number(input.ignored ?? 0)
  const failed = Number(input.failed ?? 0)
  const parts = []

  if (processed > 0) parts.push(copy.toasts.processedPart(processed))
  if (ignored > 0) parts.push(copy.toasts.ignoredPart(ignored))
  if (failed > 0) parts.push(copy.toasts.failedPart(failed))

  return parts.length ? copy.toasts.processCompleted(parts.join(', ')) : copy.toasts.noEmailProcessed
}

function getSyncSuccessMessage(copy: EmailCopy, imported?: string, autoProcessed?: string) {
  if (imported === undefined) return null
  const count = Number(imported)
  const processed = Number(autoProcessed ?? 0)
  const suffix = processed > 0 ? copy.toasts.autoProcessedSuffix(processed) : ''
  if (Number.isNaN(count)) return `${copy.toasts.mailboxSynced}${suffix}`
  if (count === 0) return copy.toasts.noNewEmails
  if (count === 1) return `${copy.toasts.oneEmailImported}${suffix}`
  return `${copy.toasts.emailsImported(count)}${suffix}`
}

function getDeleteSuccessMessage(copy: EmailCopy, deleted?: string) {
  if (deleted === undefined) return null
  const count = Number(deleted)
  if (Number.isNaN(count)) return copy.toasts.threadsDeleted
  if (count === 1) return copy.toasts.oneThreadDeleted
  return copy.toasts.manyThreadsDeleted(count)
}

function getDraftDeleteSuccessMessage(
  copy: EmailCopy,
  mode?: string,
  bulk?: { deleted?: string; providerDeleted?: string; providerFailed?: string },
) {
  if (bulk?.deleted !== undefined) {
    const deleted = Number(bulk.deleted)
    const providerDeleted = Number(bulk.providerDeleted ?? 0)
    const providerFailed = Number(bulk.providerFailed ?? 0)
    const deletedText = Number.isNaN(deleted)
      ? copy.toasts.draftsDeletedAgora
      : deleted === 1
        ? copy.toasts.oneDraftDeletedAgora
        : copy.toasts.manyDraftsDeletedAgora(deleted)
    const providerText = providerDeleted > 0
      ? providerDeleted === 1 ? copy.toasts.oneDraftDeletedProvider : copy.toasts.manyDraftsDeletedProvider(providerDeleted)
      : ''
    const failedText = providerFailed > 0
      ? providerFailed === 1 ? copy.toasts.oneDraftProviderFailed : copy.toasts.manyDraftsProviderFailed(providerFailed)
      : ''

    return `${deletedText}${providerText}${failedText}`
  }

  if (mode === 'provider') return copy.toasts.draftDeletedProvider
  if (mode === 'local') return copy.toasts.draftDeletedLocal
  return null
}

function formatProvider(copy: EmailCopy, provider?: string) {
  if (provider === 'google') return copy.provider.google
  if (provider === 'microsoft') return copy.provider.microsoft
  if (provider === 'imap') return copy.provider.imap
  if (provider === 'forwarding') return copy.provider.forwarding
  return copy.provider.unknown
}

function formatDraftMode(copy: EmailCopy, mode?: string) {
  if (mode === 'provider_drafts') return copy.draftMode.provider_drafts
  if (mode === 'agora_review') return copy.draftMode.agora_review
  if (mode === 'disabled') return copy.draftMode.disabled
  return copy.draftMode.pending
}

function formatSync(copy: EmailCopy, locale: string, mode?: string, lastSyncedAt?: string | null) {
  const label = mode === 'webhook' ? copy.syncMode.webhook : mode === 'manual' ? copy.syncMode.manual : copy.syncMode.polling
  if (!lastSyncedAt) return label
  return `${label} · ${new Date(lastSyncedAt).toLocaleString(locale === 'ca' ? 'ca-ES' : 'es-ES')}`
}

function getProviderConnectUrl(tenantId: string, provider?: string) {
  return provider === 'microsoft'
    ? `/api/email/microsoft/connect?tenantId=${tenantId}`
    : `/api/email/google/connect?tenantId=${tenantId}`
}

function GoogleProviderIcon() {
  return (
    <svg className="email-provider-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.6-2.1 3.4v2.8h3.4c2-1.8 3.4-4.5 3.4-8.2Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.6l-3.4-2.8c-.9.6-2.2 1-3.9 1-3 0-5.6-2-6.5-4.8H2v2.9C3.8 20.4 7.6 23 12 23Z" />
      <path fill="#FBBC05" d="M5.5 13.8a6.7 6.7 0 0 1 0-4.3V6.6H2A11 11 0 0 0 2 16.7l3.5-2.9Z" />
      <path fill="#EA4335" d="M12 4.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A10.6 10.6 0 0 0 12 0C7.6 0 3.8 2.6 2 6.6l3.5 2.9C6.4 6.4 9 4.4 12 4.4Z" />
    </svg>
  )
}

function MicrosoftProviderIcon() {
  return (
    <svg className="email-provider-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  )
}

function getProviderDraftsUrl(provider: string | undefined, mailboxEmail: string) {
  if (provider === 'microsoft') return 'https://outlook.office.com/mail/drafts'
  return `https://mail.google.com/mail/u/${encodeURIComponent(mailboxEmail)}/#drafts`
}

function formatThreadStatus(copy: EmailCopy, status: string) {
  return copy.statuses[status as keyof EmailCopy['statuses']] ?? status
}

function getDisplayThreadStatus(status: string, threadId: string, threadsWithDrafts: Set<string>) {
  if (status === 'drafted' && !threadsWithDrafts.has(threadId)) return 'new'
  return status
}

function getThreadStatusClass(status: string) {
  if (status === 'drafted' || status === 'sent' || status === 'resolved') return 'status-pill-active'
  if (status === 'waiting_human' || status === 'escalated') return 'status-pill-soon'
  if (status === 'ignored') return 'status-pill-muted'
  return 'status-pill-muted'
}

function getThreadInsight(copy: EmailCopy, metadata: unknown) {
  const record = getRecord(metadata)
  const classification = getRecord(record.classification)
  const rawReason = typeof classification.agent_reason === 'string'
    ? classification.agent_reason
    : typeof classification.reason === 'string'
      ? classification.reason
      : typeof record.escalation_reason === 'string'
        ? record.escalation_reason
        : null

  if (!rawReason) return copy.reasons.none
  return formatClassificationReason(copy, rawReason)
}

function formatClassificationReason(copy: EmailCopy, reason: string) {
  return copy.reasons[reason as keyof EmailCopy['reasons']] ?? reason.replaceAll('_', ' ')
}

function formatDraftStatus(copy: EmailCopy, status: string) {
  return copy.draftStatuses[status as keyof EmailCopy['draftStatuses']] ?? status
}

function getDraftStatusClass(status: string) {
  if (status === 'created_in_provider') return 'status-pill-active'
  if (status === 'error' || status === 'discarded') return 'status-pill-danger'
  if (status === 'generated') return 'status-pill-soon'
  return 'status-pill-muted'
}

function formatTopic(copy: EmailCopy, topic?: string | null) {
  if (!topic) return copy.topics.none
  return copy.topics[topic as keyof EmailCopy['topics']] ?? formatCustomTopic(topic)
}

function formatCustomTopic(topic: string) {
  return topic
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
}

function formatDateTime(value: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}
