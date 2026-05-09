import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { AlertTriangle, Bot, CheckCircle2, Inbox, Mail, PencilLine } from 'lucide-react'

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

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="section-label">Agente de email</p>
          <h1>{theatre?.name ?? 'Email'}</h1>
          <p className="muted">Borradores supervisados desde el buzón real del cliente.</p>
        </div>
        <span className={`status-pill ${connection?.status === 'connected' ? 'status-pill-active' : 'status-pill-soon'}`}>
          {formatConnectionStatus(connection?.status)}
        </span>
      </header>

      <section className="card stack">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Conexión</p>
            <h2>Buzón conectado</h2>
            <p className="muted">
              La primera versión trabajará en modo Gmail/Google Workspace: TALIA crea borradores reales y el equipo los envía desde su buzón.
            </p>
          </div>
          <Mail className="section-icon" size={20} strokeWidth={2} aria-hidden="true" />
        </div>

        <div className="overview-grid">
          <DetailCard label="Buzón" value={activeMailbox} />
          <DetailCard label="Proveedor" value={formatProvider(connection?.provider)} />
          <DetailCard label="Modo de borrador" value={formatDraftMode(connection?.draft_mode)} />
          <DetailCard label="Sincronización" value={formatSync(connection?.sync_mode, connection?.last_synced_at)} />
        </div>

        {connection?.error_message ? (
          <p className="notice notice-error">
            {connection.error_message}
          </p>
        ) : null}
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
            <p className="eyebrow">Roadmap MVP</p>
            <h2>Modo mailbox-first</h2>
          </div>
          <Bot className="section-icon" size={20} strokeWidth={2} aria-hidden="true" />
        </div>
        <div className="checklist">
          <ChecklistItem done={Boolean(connection)} label="Conectar buzón Gmail/Google Workspace por OAuth" />
          <ChecklistItem done={false} label="Sincronizar threads nuevos con cursor incremental" />
          <ChecklistItem done={false} label="Generar borrador con base de conocimiento de la venue" />
          <ChecklistItem done={false} label="Crear draft real en Gmail dentro del thread original" />
          <ChecklistItem done={false} label="Registrar uso, tema e historial de revisión" />
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
          <p className="muted">
            Aún no hay emails sincronizados. El siguiente paso técnico es conectar OAuth de Gmail y crear el primer sync polling.
          </p>
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

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={`checklist-item ${done ? 'checklist-item-done' : ''}`}>
      <span className="checklist-dot">{done ? <CheckCircle2 size={12} /> : null}</span>
      <span>{label}</span>
    </div>
  )
}
