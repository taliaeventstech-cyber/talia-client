import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { AlertTriangle, Clock3, Inbox, Mail, PencilLine, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import {
  deleteSelectedEmailThreadsAction,
  disconnectGoogleEmailAction,
  processSelectedEmailThreadsAction,
  syncLatestEmailAction,
} from './actions'

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
  }>
}

export default async function EmailAgentPage({ params, searchParams }: Props) {
  const { tenantId } = await params
  const query = searchParams ? await searchParams : {}
  await requireTenantPermission(tenantId, 'manage_email', 'email')

  const admin = createAdminClient()
  const [{ data: theatre }, { data: connections }, { data: threads }, { data: drafts }, { data: latestDrafts }] = await Promise.all([
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
      .select('id, status, priority, subject, sender_email, topic, last_message_at')
      .eq('theatre_id', tenantId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(10),
    admin
      .from('email_drafts')
      .select('id, status')
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

  const connection = connections?.[0] ?? null
  const threadCounts = countByStatus(threads ?? [])
  const draftCounts = countByStatus(drafts ?? [])
  const generatedDrafts = draftCounts.get('generated') ?? 0
  const providerDrafts = draftCounts.get('created_in_provider') ?? 0
  const waitingHuman = threadCounts.get('waiting_human') ?? 0
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
  const oauthErrorMessage = getOAuthErrorMessage(query.email_error)
  const processErrorMessage = query.email_process_error
  const syncErrorMessage = query.email_sync_error
  const deleteErrorMessage = query.email_delete_error
  const disconnectAction = disconnectGoogleEmailAction.bind(null, tenantId)
  const processSelectedAction = processSelectedEmailThreadsAction.bind(null, tenantId)
  const deleteSelectedAction = deleteSelectedEmailThreadsAction.bind(null, tenantId)
  const syncAction = syncLatestEmailAction.bind(null, tenantId)

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="section-label">Agente de email</p>
          <h1>{theatre?.name ?? 'Email'}</h1>
        </div>
        <span className={`status-pill ${getConnectionStatusClass(connection?.status)}`}>
          {formatConnectionStatus(connection?.status)}
        </span>
      </header>

      <section className={`card email-setup-hero ${isConnected ? 'email-setup-hero-ready' : ''}`}>
        <div className="email-setup-copy">
          <span className="detail-icon">
            <Mail size={17} strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="email-setup-content">
            <div className="email-setup-title-row">
              <p className="eyebrow">Conexión del buzón</p>
              <span className={`status-pill ${getConnectionStatusClass(connection?.status)}`}>
                {formatConnectionStatus(connection?.status)}
              </span>
            </div>
            <h2>{activeMailbox}</h2>
            <div className="email-setup-meta" aria-label="Configuración de email">
              <span>{formatProvider(connection?.provider)}</span>
              <span>{formatDraftMode(connection?.draft_mode)}</span>
              <span>{formatSync(connection?.sync_mode, connection?.last_synced_at)}</span>
            </div>
          </div>
        </div>

        <div className="email-setup-action">
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
      </section>

      {hasOAuthSuccess ? (
        <p className="notice notice-success">
          Buzón conectado correctamente. El siguiente paso será activar la sincronización incremental y la creación de borradores.
        </p>
      ) : null}

      {hasDisconnectSuccess ? (
        <p className="notice notice-success">
          Buzón desconectado correctamente. TALIA ya no podrá sincronizar ni preparar borradores con esta autorización.
        </p>
      ) : null}

      {processSuccessMessage ? (
        <p className="notice notice-success">{processSuccessMessage}</p>
      ) : null}

      {selectedProcessMessage ? (
        <p className="notice notice-success">{selectedProcessMessage}</p>
      ) : null}

      {syncSuccessMessage ? (
        <p className="notice notice-success">{syncSuccessMessage}</p>
      ) : null}

      {deleteSuccessMessage ? (
        <p className="notice notice-success">{deleteSuccessMessage}</p>
      ) : null}

      {oauthErrorMessage ? (
        <p className="notice notice-error">{oauthErrorMessage}</p>
      ) : null}

      {processErrorMessage ? (
        <p className="notice notice-error">No se ha podido procesar el email: {processErrorMessage}</p>
      ) : null}

      {syncErrorMessage ? (
        <p className="notice notice-error">No se ha podido sincronizar Gmail: {syncErrorMessage}</p>
      ) : null}

      {deleteErrorMessage ? (
        <p className="notice notice-error">No se han podido borrar los threads: {deleteErrorMessage}</p>
      ) : null}

      {isError || connection?.error_message ? (
        <p className="notice notice-error">
          {connection?.error_message ?? 'Hay un error en la conexión del buzón. Revisa permisos o credenciales.'}
        </p>
      ) : null}

      <section className="email-status-grid">
        <DetailCard label="Proveedor" value={formatProvider(connection?.provider)} />
        <DetailCard label="Procesados" value={String(threads?.length ?? 0)} />
        <DetailCard label="Drafts Gmail" value={String(providerDrafts)} />
        <DetailCard label="Pendientes" value={String(waitingHuman)} />
      </section>

      <section className="overview-grid">
        <MetricCard icon={<Inbox size={18} />} label="Threads recientes" value={threads?.length ?? 0} />
        <MetricCard icon={<PencilLine size={18} />} label="Drafts generados" value={generatedDrafts + providerDrafts} />
        <MetricCard icon={<Mail size={18} />} label="En Gmail" value={providerDrafts} />
        <MetricCard icon={<AlertTriangle size={18} />} label="Pendientes humano" value={waitingHuman} />
      </section>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Threads</p>
            <h2>Emails sincronizados</h2>
          </div>
        </div>

        {(threads ?? []).length ? (
          <form className="email-thread-selection" action={processSelectedAction}>
            <div className="email-thread-toolbar">
              <button className="button-primary button-fit" type="submit" formAction={processSelectedAction}>
                <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
                Procesar seleccionados
              </button>
              <button className="button-outline button-danger button-fit" type="submit" formAction={deleteSelectedAction}>
                <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
                Borrar seleccionados
              </button>
            </div>

            <table className="data-table email-thread-table">
              <thead>
                <tr>
                  <th className="email-select-cell">Sel.</th>
                  <th>Asunto</th>
                  <th>Remitente</th>
                  <th>Estado</th>
                  <th>Prioridad</th>
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
                    <td>{thread.subject ?? 'Sin asunto'}</td>
                    <td>{thread.sender_email ?? '-'}</td>
                    <td><span className="status-pill status-pill-muted">{formatThreadStatus(thread.status)}</span></td>
                    <td>{formatPriority(thread.priority)}</td>
                    <td>{formatTopic(thread.topic)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <p className="eyebrow">Borradores</p>
            <h2>Últimos drafts creados</h2>
          </div>
        </div>

        {(latestDrafts ?? []).length ? (
          <div className="email-draft-list">
            {(latestDrafts ?? []).map((draft) => {
              const thread = Array.isArray(draft.email_threads)
                ? draft.email_threads[0]
                : draft.email_threads

              return (
                <article className="email-draft-item" key={draft.id}>
                  <div className="email-draft-main">
                    <span className={`status-pill ${getDraftStatusClass(draft.status)}`}>
                      {formatDraftStatus(draft.status)}
                    </span>
                    <div>
                      <strong>{draft.generated_subject ?? thread?.subject ?? 'Sin asunto'}</strong>
                      <p className="muted">
                        {thread?.sender_email ?? 'Remitente no identificado'} · {formatTopic(thread?.topic)}
                      </p>
                    </div>
                  </div>
                  <div className="email-draft-meta">
                    <span>{formatDateTime(draft.updated_at ?? draft.created_at)}</span>
                    {draft.provider_draft_id ? (
                      <code>{draft.provider_draft_id}</code>
                    ) : draft.error_message ? (
                      <span className="email-error-text">{draft.error_message}</span>
                    ) : (
                      <span>Sin draft proveedor</span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <PencilLine size={18} aria-hidden="true" />
            <div>
              <strong>Aún no hay borradores</strong>
              <p className="muted">Cuando proceses emails, los drafts generados aparecerán aquí con su estado.</p>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

function countByStatus(items: { status: string }[]) {
  return items.reduce((map, item) => {
    map.set(item.status, (map.get(item.status) ?? 0) + 1)
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
    return 'Email procesado. TALIA ha creado un borrador real en Gmail.'
  }
  if (action === 'draft_generated') {
    return 'Email procesado. TALIA ha guardado el borrador para revisión.'
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

  if (processed > 0) parts.push(`${processed} ${processed === 1 ? 'draft generado' : 'drafts generados'}`)
  if (ignored > 0) parts.push(`${ignored} ${ignored === 1 ? 'thread ignorado' : 'threads ignorados'}`)
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

function formatProvider(provider?: string) {
  if (provider === 'google') return 'Google Workspace'
  if (provider === 'microsoft') return 'Microsoft 365'
  if (provider === 'imap') return 'IMAP'
  if (provider === 'forwarding') return 'Forwarding TALIA'
  return 'No configurado'
}

function formatDraftMode(mode?: string) {
  if (mode === 'provider_drafts') return 'Borradores en buzón'
  if (mode === 'agora_review') return 'Revisión en Àgora'
  if (mode === 'disabled') return 'Sin borradores'
  return 'Pendiente'
}

function formatSync(mode?: string, lastSyncedAt?: string | null) {
  const label = mode === 'webhook' ? 'Webhook' : mode === 'manual' ? 'Manual' : 'Polling'
  if (!lastSyncedAt) return label
  return `${label} · ${new Date(lastSyncedAt).toLocaleString('es-ES')}`
}

function formatThreadStatus(status: string) {
  const labels: Record<string, string> = {
    new: 'Nuevo',
    drafted: 'Borrador',
    waiting_human: 'Revisión',
    sent: 'Enviado',
    resolved: 'Resuelto',
    escalated: 'Escalado',
    ignored: 'Ignorado',
  }

  return labels[status] ?? status
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

function formatPriority(priority: string) {
  const labels: Record<string, string> = {
    low: 'Baja',
    normal: 'Normal',
    high: 'Alta',
    urgent: 'Urgente',
  }

  return labels[priority] ?? priority
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

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-block">
      <p className="detail-label">{label}</p>
      <p className="detail-value">{value}</p>
    </div>
  )
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="kpi-card stack">
      <span className="detail-icon" aria-hidden="true">{icon}</span>
      <div>
        <p className="kpi-label">{label}</p>
        <strong className="kpi-value">{value}</strong>
      </div>
    </div>
  )
}
