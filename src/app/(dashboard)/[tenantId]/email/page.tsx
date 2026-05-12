import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { AlertTriangle, Bot, CheckCircle2, Clock3, Inbox, Mail, PencilLine, Send, ShieldCheck } from 'lucide-react'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function EmailAgentPage({ params }: Props) {
  const { tenantId } = await params
  await requireTenantPermission(tenantId, 'manage_email', 'email')

  const admin = createAdminClient()
  const [{ data: theatre }, { data: connections }, { data: threads }, { data: drafts }] = await Promise.all([
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

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="section-label">Agente de email</p>
          <h1>{theatre?.name ?? 'Email'}</h1>
          <p className="muted">Borradores supervisados desde el buzón real del cliente.</p>
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
          <div>
            <p className="eyebrow">Conexión del buzón</p>
            <h2>{isConnected ? 'Buzón listo para trabajar con borradores' : 'Conecta el buzón del equipo de atención'}</h2>
            <p className="muted">
              TALIA leerá los emails autorizados, generará respuestas con la base de conocimiento y las dejará como borradores para revisión humana.
            </p>
          </div>
        </div>

        <div className="email-setup-action">
          <button className="button-primary" type="button" disabled>
            {isConnected ? 'Reconectar buzón' : 'Conectar Gmail'}
          </button>
          <p className="muted">
            OAuth de Google pendiente de activar. La conexión operativa se prepara desde Backstage.
          </p>
        </div>
      </section>

      {isError || connection?.error_message ? (
        <p className="notice notice-error">
          {connection?.error_message ?? 'Hay un error en la conexión del buzón. Revisa permisos o credenciales.'}
        </p>
      ) : null}

      <section className="email-status-grid">
        <DetailCard label="Buzón" value={activeMailbox} />
        <DetailCard label="Proveedor" value={formatProvider(connection?.provider)} />
        <DetailCard label="Modo de borrador" value={formatDraftMode(connection?.draft_mode)} />
        <DetailCard label="Sincronización" value={formatSync(connection?.sync_mode, connection?.last_synced_at)} />
      </section>

      <section className="overview-grid">
        <MetricCard icon={<Inbox size={18} />} label="Threads recientes" value={threads?.length ?? 0} />
        <MetricCard icon={<PencilLine size={18} />} label="Drafts generados" value={generatedDrafts + providerDrafts} />
        <MetricCard icon={<AlertTriangle size={18} />} label="Pendientes humano" value={waitingHuman} />
        <MetricCard icon={<CheckCircle2 size={18} />} label="Resueltos" value={threadCounts.get('resolved') ?? 0} />
      </section>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Funcionamiento</p>
            <h2>Borradores supervisados</h2>
            <p className="muted">El agente de email está diseñado para trabajar dentro del buzón real del cliente.</p>
          </div>
          <Bot className="section-icon" size={20} strokeWidth={2} aria-hidden="true" />
        </div>
        <div className="email-flow-grid">
          <FlowStep
            icon={<Inbox size={17} />}
            title="1. Entra un email"
            description="TALIA detecta nuevas consultas del buzón conectado."
            done={Boolean(connection)}
          />
          <FlowStep
            icon={<PencilLine size={17} />}
            title="2. TALIA prepara respuesta"
            description="Usa FAQs, fuentes y reglas de la venue para generar un borrador."
            done={Boolean(connection) && generatedDrafts + providerDrafts > 0}
          />
          <FlowStep
            icon={<Send size={17} />}
            title="3. El equipo envía"
            description="El humano revisa y envía desde Gmail/Outlook. TALIA no auto-envía en el MVP."
            done={threadCounts.get('sent') ? true : false}
          />
        </div>
      </section>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Preparación</p>
            <h2>Checklist técnico</h2>
          </div>
          <ShieldCheck className="section-icon" size={20} strokeWidth={2} aria-hidden="true" />
        </div>
        <div className="checklist">
          <ChecklistItem done={Boolean(connection)} label="Configurar buzón desde Backstage" />
          <ChecklistItem done={isConnected} label="Conectar Gmail/Google Workspace por OAuth" />
          <ChecklistItem done={Boolean(connection?.last_synced_at)} label="Sincronizar threads nuevos con cursor incremental" />
          <ChecklistItem done={generatedDrafts + providerDrafts > 0} label="Crear primer borrador real en el buzón" />
          <ChecklistItem done={threadCounts.get('resolved') ? true : false} label="Registrar resolución y tema de la conversación" />
        </div>
      </section>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Threads</p>
            <h2>Últimos emails procesados</h2>
          </div>
        </div>

        {(threads ?? []).length ? (
          <table className="data-table">
            <thead>
              <tr>
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
                  <td>{thread.subject ?? 'Sin asunto'}</td>
                  <td>{thread.sender_email ?? '-'}</td>
                  <td><span className="status-pill status-pill-muted">{formatThreadStatus(thread.status)}</span></td>
                  <td>{formatPriority(thread.priority)}</td>
                  <td>{thread.topic}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

function formatPriority(priority: string) {
  const labels: Record<string, string> = {
    low: 'Baja',
    normal: 'Normal',
    high: 'Alta',
    urgent: 'Urgente',
  }

  return labels[priority] ?? priority
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

function FlowStep({
  icon,
  title,
  description,
  done,
}: {
  icon: React.ReactNode
  title: string
  description: string
  done: boolean
}) {
  return (
    <div className={`email-flow-step ${done ? 'email-flow-step-done' : ''}`}>
      <span className="detail-icon" aria-hidden="true">{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  )
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={`checklist-item ${done ? 'checklist-item-done' : ''}`}>
      <span className="checklist-dot">{done ? <CheckCircle2 size={12} /> : null}</span>
      <span>{label}</span>
    </div>
  )
}
