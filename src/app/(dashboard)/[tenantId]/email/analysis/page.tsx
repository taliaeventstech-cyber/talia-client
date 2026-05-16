import { requireTenantPermission } from '@/lib/auth/tenant-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { AlertTriangle, Brain, Inbox, MailCheck } from 'lucide-react'

interface Props {
  params: Promise<{ tenantId: string }>
}

export default async function EmailAnalysisPage({ params }: Props) {
  const { tenantId } = await params
  await requireTenantPermission(tenantId, 'manage_email', 'email')

  const admin = createAdminClient()
  const { data: threads } = await admin
    .from('email_threads')
    .select('id, status, topic, priority, metadata, last_message_at, subject, sender_email')
    .eq('theatre_id', tenantId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1000)

  const rows = threads ?? []
  const topicStats = getStats(rows.map((thread) => formatTopic(thread.topic)))
  const statusStats = getStats(rows.map((thread) => formatThreadStatus(thread.status)))
  const reasonStats = getStats(rows.map((thread) => getClassificationReason(thread.metadata)).filter(Boolean))
  const knowledgeCount = rows.filter((thread) => hasKnowledgeMatches(thread.metadata)).length
  const reviewCount = rows.filter((thread) => thread.status === 'waiting_human' || thread.status === 'escalated').length
  const preparedCount = rows.filter((thread) => thread.status === 'drafted').length
  const recentClassified = rows
    .filter((thread) => getClassificationReason(thread.metadata))
    .slice(0, 12)

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="section-label">Agente de email</p>
          <h1>Análisis</h1>
          <p className="muted">
            Clasificaciones generadas por el agente clasificador sobre los emails sincronizados.
          </p>
        </div>
      </header>

      <section className="overview-grid">
        <MetricCard icon={<Inbox size={18} />} label="Emails analizados" value={rows.length} />
        <MetricCard icon={<MailCheck size={18} />} label="Respuestas preparadas" value={preparedCount} />
        <MetricCard icon={<AlertTriangle size={18} />} label="Requieren revisión" value={reviewCount} />
        <MetricCard icon={<Brain size={18} />} label="Con conocimiento" value={knowledgeCount} />
      </section>

      <section className="overview-two-column">
        <AnalysisCard
          emptyText="Aún no hay temas clasificados."
          rows={topicStats}
          title="Temas detectados"
        />
        <AnalysisCard
          emptyText="Aún no hay estados suficientes."
          rows={statusStats}
          title="Estado operativo"
        />
      </section>

      <section className="card stack">
        <div>
          <p className="eyebrow">Clasificación</p>
          <h2>Motivos principales</h2>
          <p className="muted">Motivos devueltos por el clasificador o por las reglas locales previas al agente.</p>
        </div>
        {reasonStats.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Motivo</th>
                <th>Emails</th>
                <th>Peso</th>
              </tr>
            </thead>
            <tbody>
              {reasonStats.map((item) => (
                <tr key={item.label}>
                  <td>{item.label}</td>
                  <td>{item.count}</td>
                  <td>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${item.percentage}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Aún no hay motivos de clasificación disponibles.</p>
        )}
      </section>

      <section className="card stack">
        <div>
          <p className="eyebrow">Recientes</p>
          <h2>Últimas clasificaciones</h2>
        </div>
        {recentClassified.length ? (
          <table className="data-table email-analysis-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Tema</th>
                <th>Motivo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recentClassified.map((thread) => (
                <tr key={thread.id}>
                  <td>
                    <div className="email-thread-subject">
                      <strong>{thread.subject ?? 'Sin asunto'}</strong>
                      <span>{thread.sender_email ?? 'Remitente no identificado'}</span>
                    </div>
                  </td>
                  <td>{formatTopic(thread.topic)}</td>
                  <td>{getClassificationReason(thread.metadata) ?? '-'}</td>
                  <td><span className="status-pill status-pill-muted">{formatThreadStatus(thread.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Cuando el clasificador procese emails, aparecerán aquí.</p>
        )}
      </section>
    </main>
  )
}

function AnalysisCard({
  emptyText,
  rows,
  title,
}: {
  emptyText: string
  rows: { label: string; count: number; percentage: number }[]
  title: string
}) {
  return (
    <section className="card stack">
      <h2>{title}</h2>
      {rows.length ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Emails</th>
              <th>Peso</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.label}>
                <td>{item.label}</td>
                <td>{item.count}</td>
                <td>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${item.percentage}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">{emptyText}</p>
      )}
    </section>
  )
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="kpi-card">
      <div className="detail-icon">{icon}</div>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
    </div>
  )
}

function getStats(labels: (string | null | undefined)[]) {
  const counts = new Map<string, number>()
  labels.forEach((label) => {
    if (!label || label === 'Sin tema') return
    counts.set(label, (counts.get(label) ?? 0) + 1)
  })
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0)

  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percentage: total === 0 ? 0 : Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
}

function getClassificationReason(metadata: unknown) {
  const record = getRecord(metadata)
  const classification = getRecord(record.classification)
  const rawReason = typeof classification.agent_reason === 'string'
    ? classification.agent_reason
    : typeof classification.reason === 'string'
      ? classification.reason
      : typeof record.escalation_reason === 'string'
        ? record.escalation_reason
        : null

  return rawReason ? formatClassificationReason(rawReason) : null
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

function getRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}
