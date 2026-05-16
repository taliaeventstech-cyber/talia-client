import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { QueryToastNotice } from '@/components/ui/query-toast-notice'
import { SelectAllCheckbox } from '@/components/ui/select-all-checkbox'
import { ChevronLeft, ChevronRight, Clock3, ExternalLink, Mail, PencilLine, RefreshCw } from 'lucide-react'
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

const threadStatusFilters = [
  { value: 'all', label: 'Todos' },
  { value: 'new', label: 'Sin procesar' },
  { value: 'drafted', label: 'Respuesta preparada' },
  { value: 'waiting_human', label: 'Requiere revisión' },
  { value: 'ignored', label: 'No accionable' },
] as const

export default async function EmailAgentPage({ params, searchParams }: Props) {
  const { tenantId } = await params
  const query = searchParams ? await searchParams : {}
  await requireTenantPermission(tenantId, 'manage_email', 'email')

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
  const activeMailbox = connection?.mailbox_email ?? theatre?.fallback_email ?? 'Sin buzón conectado'
  const isConnected = connection?.status === 'connected' || connection?.status === 'syncing'
  const isError = connection?.status === 'error'
  const hasOAuthSuccess = query.email_connected === '1'
  const hasDisconnectSuccess = query.email_disconnected === '1'
  const processSuccessMessage = getProcessSuccessMessage(query.email_processed)
  const selectedProcessMessage = getSelectedProcessMessage({
    processed: query.email_selected_processed,
    ignored: query.email_selected_ignored,
    failed: query.email_selected_failed,
  })
  const syncSuccessMessage = getSyncSuccessMessage(query.email_synced, query.email_auto_processed)
  const deleteSuccessMessage = getDeleteSuccessMessage(query.email_deleted)
  const draftDeleteSuccessMessage = getDraftDeleteSuccessMessage(
    query.email_draft_deleted,
    {
      deleted: query.email_drafts_deleted,
      providerDeleted: query.email_provider_drafts_deleted,
      providerFailed: query.email_provider_drafts_failed,
    },
  )
  const oauthErrorMessage = getOAuthErrorMessage(query.email_error)
  const processErrorMessage = query.email_process_error
  const syncErrorMessage = query.email_sync_error
  const deleteErrorMessage = query.email_delete_error
  const draftDeleteErrorMessage = query.email_draft_delete_error
  const successToast = hasOAuthSuccess
    ? 'Buzón conectado correctamente.'
    : hasDisconnectSuccess
      ? 'Buzón desconectado correctamente.'
      : selectedProcessMessage ?? syncSuccessMessage ?? deleteSuccessMessage ?? draftDeleteSuccessMessage ?? processSuccessMessage
  const errorToast = oauthErrorMessage
    ?? (processErrorMessage ? `No se ha podido procesar el email: ${processErrorMessage}` : null)
    ?? (syncErrorMessage ? `No se ha podido sincronizar Gmail: ${syncErrorMessage}` : null)
    ?? (deleteErrorMessage ? `No se han podido borrar los threads: ${deleteErrorMessage}` : null)
    ?? (draftDeleteErrorMessage ? `No se ha podido borrar el draft: ${draftDeleteErrorMessage}` : null)
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
          <p className="section-label">Agente de email</p>
          <div className="page-title-row">
            <h1>{theatre?.name ?? 'Email'}</h1>
            <span className={`status-pill ${getConnectionStatusClass(connection?.status)}`}>
              {formatConnectionStatus(connection?.status)}
            </span>
            <div className="email-header-mailbox">
              <span className="detail-icon" aria-hidden="true">
                <Mail size={16} strokeWidth={2} />
              </span>
              <div>
                <strong>{activeMailbox}</strong>
                <p>
                  {formatProvider(connection?.provider)} · {formatDraftMode(connection?.draft_mode)} · {formatSync(connection?.sync_mode, connection?.last_synced_at)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {isError || connection?.error_message ? (
        <p className="notice notice-error">
          {connection?.error_message ?? 'Hay un error en la conexión del buzón. Revisa permisos o credenciales.'}
        </p>
      ) : null}

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Bandeja</p>
            <h2>Emails sincronizados</h2>
          </div>
          <Suspense fallback={<PageSizeSelectFallback value={threadPagination.limit} />}>
            <ThreadPageSizeSelect value={threadPagination.limit} />
          </Suspense>
        </div>

        <div className="email-action-strip">
          <div className="email-action-buttons">
            {isConnected ? (
              <form action={syncAction}>
                <button className="button-primary button-fit" type="submit">
                  <RefreshCw size={15} strokeWidth={2} aria-hidden="true" />
                  Sincronizar Gmail
                </button>
              </form>
            ) : null}
            <a className="button-outline button-fit" href={`/api/email/google/connect?tenantId=${tenantId}`}>
              {isConnected ? 'Reconectar' : 'Conectar Gmail'}
            </a>
            {isConnected ? (
              <form action={disconnectAction}>
                <button className="button-outline button-danger button-fit" type="submit">
                  Desconectar
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <ThreadStatusFilters
          activeStatus={activeThreadStatus}
          counts={threadStatusCounts}
          limit={threadPagination.limit}
          tenantId={tenantId}
          total={threadTotal}
        />

        {(threads ?? []).length ? (
          <form className="email-thread-selection" action={processSelectedAction}>
            <div className="email-thread-toolbar">
              <div className="email-thread-toolbar-main">
                <ProcessEmailSubmitButton />
              </div>
              <div className="email-thread-toolbar-aside">
                <SelectedDeleteSubmitButton formAction={deleteSelectedAction} targetName="thread_ids" />
              </div>
            </div>

            <table className="data-table email-thread-table">
              <thead>
                <tr>
                  <th className="email-select-cell">
                    <SelectAllCheckbox label="Seleccionar todos los threads visibles" targetName="thread_ids" />
                  </th>
                  <th>Asunto</th>
                  <th>Remitente</th>
                  <th>Estado</th>
                  <th>Tema</th>
                </tr>
              </thead>
              <tbody>
                {(threads ?? []).map((thread) => (
                  <tr key={thread.id}>
                    <td className="email-select-cell">
                      <input
                        aria-label={`Seleccionar ${thread.subject ?? 'thread sin asunto'}`}
                        name="thread_ids"
                        type="checkbox"
                        value={thread.id}
                      />
                    </td>
                    <td>
                      <div className="email-thread-subject">
                        <strong>{thread.subject ?? 'Sin asunto'}</strong>
                        <span>{getThreadInsight(thread.metadata)}</span>
                      </div>
                    </td>
                    <td><span className="email-thread-sender">{thread.sender_email ?? '-'}</span></td>
                    <td>
                      <span className={`status-pill ${getThreadStatusClass(getDisplayThreadStatus(thread.status, thread.id, visibleThreadsWithDrafts))}`}>
                        {formatThreadStatus(getDisplayThreadStatus(thread.status, thread.id, visibleThreadsWithDrafts))}
                      </span>
                    </td>
                    <td>
                      <div className="email-thread-topic">
                        <span>{formatTopic(thread.topic)}</span>
                        {hasKnowledgeMatches(thread.metadata) ? <span className="email-knowledge-pill">Conocimiento</span> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination
              hrefForPage={(page) => getThreadPageHref(tenantId, { page, limit: threadPagination.limit, status: activeThreadStatus })}
              page={threadPage}
              pageCount={threadPageCount}
              total={filteredThreadCount}
            />
          </form>
        ) : (
          <div className="empty-state">
            <Clock3 size={18} aria-hidden="true" />
            <div>
              <strong>Aún no hay emails sincronizados</strong>
              <p className="muted">
                Cuando se active OAuth, aquí aparecerán los últimos hilos procesados y sus borradores asociados.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Respuestas</p>
            <h2>Últimas respuestas preparadas</h2>
          </div>
          {connection?.mailbox_email ? (
            <a className="button-outline button-fit" href={getGmailDraftsUrl(connection.mailbox_email)} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} strokeWidth={2} aria-hidden="true" />
              Abrir Gmail
            </a>
          ) : null}
        </div>

        {(latestDrafts ?? []).length ? (
          <form className="email-draft-selection" action={deleteSelectedDraftsAction}>
            <div className="email-thread-toolbar">
              <div className="email-thread-toolbar-main">
                <label className="bulk-select-row">
                  <SelectAllCheckbox label="Seleccionar todas las respuestas visibles" targetName="draft_ids" />
                  Seleccionar todo
                </label>
              </div>
              <div className="email-thread-toolbar-aside">
                <DraftDeleteChoiceButton
                  label="Borrar"
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
                      aria-label={`Seleccionar respuesta ${draft.generated_subject ?? thread?.subject ?? 'sin asunto'}`}
                      className="email-draft-checkbox"
                      name="draft_ids"
                      type="checkbox"
                      value={draft.id}
                    />
                    {draft.status === 'created_in_provider' ? null : (
                      <span className={`status-pill ${getDraftStatusClass(draft.status)}`}>
                        {formatDraftStatus(draft.status)}
                      </span>
                    )}
                    <div>
                      <strong>{draft.generated_subject ?? thread?.subject ?? 'Sin asunto'}</strong>
                      <p className="muted">
                        {thread?.sender_email ?? 'Remitente no identificado'} · {formatTopic(thread?.topic)}
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
              <strong>Aún no hay respuestas preparadas</strong>
              <p className="muted">Cuando proceses emails, las respuestas preparadas aparecerán aquí con su estado.</p>
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
  return threadStatusFilters.some((filter) => filter.value === value) ? value as typeof threadStatusFilters[number]['value'] : 'all'
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
  limit,
  tenantId,
  total,
}: {
  activeStatus: string
  counts: Map<string, number>
  limit: number
  tenantId: string
  total: number
}) {
  return (
    <nav className="email-thread-filters" aria-label="Filtrar emails por estado">
      {threadStatusFilters.map((filter) => {
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
            <span>{filter.label}</span>
            <strong>{count}</strong>
          </Link>
        )
      })}
    </nav>
  )
}

function PageSizeSelectFallback({ value }: { value: number }) {
  return (
    <label className="table-page-size">
      <span>Por página</span>
      <span className="table-page-size-select">
        <select aria-label="Emails por página" defaultValue={value}>
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
  page,
  pageCount,
  total,
}: {
  hrefForPage: (page: number) => string
  page: number
  pageCount: number
  total: number
}) {
  if (total === 0) return null

  return (
    <nav className="table-pagination" aria-label="Paginación de emails sincronizados">
      <p>Página {page} de {pageCount}</p>
      <div className="table-pagination-actions">
        {page > 1 ? (
          <Link className="pagination-icon-button" href={hrefForPage(page - 1)} aria-label="Página anterior" scroll={false}>
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        ) : (
          <span className="pagination-icon-button button-disabled" aria-label="Página anterior">
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          </span>
        )}
        {page < pageCount ? (
          <Link className="pagination-icon-button" href={hrefForPage(page + 1)} aria-label="Página siguiente" scroll={false}>
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        ) : (
          <span className="pagination-icon-button button-disabled" aria-label="Página siguiente">
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

function formatConnectionStatus(status?: string) {
  if (status === 'connected') return 'Conectado'
  if (status === 'syncing') return 'Sincronizando'
  if (status === 'error') return 'Error'
  if (status === 'revoked') return 'Revocado'
  if (status === 'disabled') return 'Desactivado'
  return 'Pendiente'
}

function getOAuthErrorMessage(error?: string) {
  if (!error) return null
  if (error === 'oauth_config') {
    return 'Falta configurar OAuth de Google en el entorno de TALIA.'
  }
  if (error === 'oauth_callback') {
    return 'Google ha devuelto la autorización, pero TALIA no ha podido guardar la conexión.'
  }
  if (error === 'missing_code') {
    return 'Google no ha devuelto el código de autorización.'
  }
  if (error === 'access_denied') {
    return 'La autorización de Google se ha cancelado.'
  }
  if (error === 'no_connection') {
    return 'No hay ninguna conexión de Gmail activa para desconectar.'
  }
  if (error === 'disconnect_failed') {
    return 'No se ha podido guardar la desconexión de Gmail.'
  }

  return `No se ha podido conectar Gmail: ${error}`
}

function getProcessSuccessMessage(action?: string) {
  if (action === 'provider_draft_created') {
    return 'Email procesado. TALIA ha preparado la respuesta en Gmail.'
  }
  if (action === 'draft_generated') {
    return 'Email procesado. TALIA ha guardado la respuesta para revisión.'
  }
  if (action === 'ignored') {
    return 'Email procesado. TALIA lo ha marcado como no accionable.'
  }
  return null
}

function getSelectedProcessMessage(input: { processed?: string; ignored?: string; failed?: string }) {
  if (input.processed === undefined && input.ignored === undefined && input.failed === undefined) return null
  const processed = Number(input.processed ?? 0)
  const ignored = Number(input.ignored ?? 0)
  const failed = Number(input.failed ?? 0)
  const parts = []

  if (processed > 0) parts.push(`${processed} ${processed === 1 ? 'respuesta preparada' : 'respuestas preparadas'}`)
  if (ignored > 0) parts.push(`${ignored} ${ignored === 1 ? 'thread no accionable' : 'threads no accionables'}`)
  if (failed > 0) parts.push(`${failed} ${failed === 1 ? 'fallo' : 'fallos'}`)

  return parts.length ? `Procesamiento completado: ${parts.join(', ')}.` : 'No se ha procesado ningún thread.'
}

function getSyncSuccessMessage(imported?: string, autoProcessed?: string) {
  if (imported === undefined) return null
  const count = Number(imported)
  const processed = Number(autoProcessed ?? 0)
  const suffix = processed > 0
    ? ` TALIA ha procesado ${processed === 1 ? '1 email' : `${processed} emails`} automáticamente.`
    : ''
  if (Number.isNaN(count)) return `Gmail sincronizado.${suffix}`
  if (count === 0) return 'Gmail sincronizado. No había emails nuevos.'
  if (count === 1) return `Gmail sincronizado. Se ha importado 1 email nuevo.${suffix}`
  return `Gmail sincronizado. Se han importado ${count} emails nuevos.${suffix}`
}

function getDeleteSuccessMessage(deleted?: string) {
  if (deleted === undefined) return null
  const count = Number(deleted)
  if (Number.isNaN(count)) return 'Threads borrados.'
  if (count === 1) return 'Se ha borrado 1 thread y sus mensajes.'
  return `Se han borrado ${count} threads y sus mensajes.`
}

function getDraftDeleteSuccessMessage(
  mode?: string,
  bulk?: { deleted?: string; providerDeleted?: string; providerFailed?: string },
) {
  if (bulk?.deleted !== undefined) {
    const deleted = Number(bulk.deleted)
    const providerDeleted = Number(bulk.providerDeleted ?? 0)
    const providerFailed = Number(bulk.providerFailed ?? 0)
    const deletedText = Number.isNaN(deleted)
      ? 'Respuestas eliminadas de Àgora.'
      : deleted === 1
        ? 'Se ha eliminado 1 respuesta de Àgora.'
        : `Se han eliminado ${deleted} respuestas de Àgora.`
    const providerText = providerDeleted > 0
      ? ` ${providerDeleted === 1 ? 'También se ha borrado 1 respuesta en Gmail.' : `También se han borrado ${providerDeleted} respuestas en Gmail.`}`
      : ''
    const failedText = providerFailed > 0
      ? ` ${providerFailed === 1 ? '1 respuesta no se ha podido borrar en Gmail.' : `${providerFailed} respuestas no se han podido borrar en Gmail.`}`
      : ''

    return `${deletedText}${providerText}${failedText}`
  }

  if (mode === 'provider') return 'Respuesta eliminada de Gmail y de Àgora.'
  if (mode === 'local') return 'Respuesta eliminada de Àgora.'
  return null
}

function formatProvider(provider?: string) {
  if (provider === 'google') return 'Google Workspace'
  if (provider === 'microsoft') return 'Microsoft 365'
  if (provider === 'imap') return 'IMAP'
  if (provider === 'forwarding') return 'Forwarding TALIA'
  return 'No configurado'
}

function formatDraftMode(mode?: string) {
  if (mode === 'provider_drafts') return 'Respuestas en Gmail'
  if (mode === 'agora_review') return 'Revisión en Àgora'
  if (mode === 'disabled') return 'Sin respuestas'
  return 'Pendiente'
}

function formatSync(mode?: string, lastSyncedAt?: string | null) {
  const label = mode === 'webhook' ? 'Webhook' : mode === 'manual' ? 'Manual' : 'Polling'
  if (!lastSyncedAt) return label
  return `${label} · ${new Date(lastSyncedAt).toLocaleString('es-ES')}`
}

function getGmailDraftsUrl(mailboxEmail: string) {
  return `https://mail.google.com/mail/u/${encodeURIComponent(mailboxEmail)}/#drafts`
}

function formatThreadStatus(status: string) {
  const labels: Record<string, string> = {
    new: 'Sin procesar',
    drafted: 'Respuesta preparada',
    waiting_human: 'Requiere revisión',
    sent: 'Enviado',
    resolved: 'Cerrado',
    escalated: 'Escalado',
    ignored: 'No accionable',
  }

  return labels[status] ?? status
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

function getThreadInsight(metadata: unknown) {
  const record = getRecord(metadata)
  const classification = getRecord(record.classification)
  const rawReason = typeof classification.agent_reason === 'string'
    ? classification.agent_reason
    : typeof classification.reason === 'string'
      ? classification.reason
      : typeof record.escalation_reason === 'string'
        ? record.escalation_reason
        : null

  if (!rawReason) return 'Sin motivo de clasificación'
  return formatClassificationReason(rawReason)
}

function hasKnowledgeMatches(metadata: unknown) {
  const record = getRecord(metadata)
  return typeof record.knowledge_match_count === 'number' && record.knowledge_match_count > 0
}

function formatClassificationReason(reason: string) {
  const labels: Record<string, string> = {
    candidate_for_agent: 'Candidato para agente',
    visitor_question: 'Pregunta de visitante',
    newsletter: 'Newsletter',
    spam: 'Spam',
    auto_reply: 'Respuesta automática',
    bounce: 'Rebote de correo',
    complaint: 'Queja',
    group_request: 'Solicitud de grupo',
    refund_request: 'Solicitud de devolución',
    partnership_request: 'Partnership / colaboración',
    missing_context: 'Falta contexto',
    non_actionable: 'No accionable',
    blocked_sender: 'Remitente bloqueado',
    blocked_domain: 'Dominio bloqueado',
    automated_email: 'Email automático',
    empty_body: 'Sin contenido suficiente',
    other: 'Otro motivo',
  }

  return labels[reason] ?? reason.replaceAll('_', ' ')
}

function formatDraftStatus(status: string) {
  const labels: Record<string, string> = {
    generated: 'Generado',
    created_in_provider: 'En Gmail',
    edited_by_human: 'Editado',
    approved: 'Aprobado',
    sent: 'Enviado',
    discarded: 'Descartado',
    error: 'Error',
  }

  return labels[status] ?? status
}

function getDraftStatusClass(status: string) {
  if (status === 'created_in_provider') return 'status-pill-active'
  if (status === 'error' || status === 'discarded') return 'status-pill-danger'
  if (status === 'generated') return 'status-pill-soon'
  return 'status-pill-muted'
}

function formatTopic(topic?: string | null) {
  if (!topic) return 'Sin tema'
  const labels: Record<string, string> = {
    entradas: 'Entradas',
    horarios: 'Horarios',
    ubicacion: 'Ubicación',
    accesibilidad: 'Accesibilidad',
    programacion: 'Programación',
    grupos: 'Grupos',
    devoluciones: 'Devoluciones',
    otro: 'Otro',
  }

  return labels[topic] ?? topic
}

function formatDateTime(value: string | null) {
  if (!value) return 'Sin fecha'
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
