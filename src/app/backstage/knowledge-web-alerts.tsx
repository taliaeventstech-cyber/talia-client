import type { KnowledgeWebOperationalAlert } from '@/lib/knowledge/web-source-alerts'
import { AlertTriangle, ArrowRight, CircleAlert } from 'lucide-react'
import Link from 'next/link'

interface Props {
  alerts: KnowledgeWebOperationalAlert[]
  error?: string | null
  showTenant?: boolean
  title?: string
}

export function KnowledgeWebAlerts({
  alerts,
  error = null,
  showTenant = true,
  title = 'Fuentes web que requieren atención',
}: Props) {
  const criticalCount = alerts.filter((alert) => alert.severity === 'critical').length

  return (
    <section className="knowledge-web-alerts" aria-labelledby="knowledge-web-alerts-title">
      <div className="knowledge-web-alerts-heading">
        <div>
          <p className="eyebrow">Operaciones</p>
          <h2 id="knowledge-web-alerts-title">{title}</h2>
        </div>
        <div className="section-heading-actions" aria-label="Resumen de alertas">
          {criticalCount > 0 ? (
            <span className="status-pill knowledge-web-alert-count-critical">{criticalCount} críticas</span>
          ) : null}
          <span className="status-pill status-pill-muted">{alerts.length} activas</span>
        </div>
      </div>

      {error ? <p className="rag-health-notice rag-health-notice-error">{error}</p> : null}

      {!error && alerts.length === 0 ? (
        <p className="knowledge-web-alerts-empty">No hay incidencias operativas activas.</p>
      ) : null}

      {alerts.length > 0 ? (
        <div className="knowledge-web-alerts-list">
          {alerts.map((alert) => (
            <article
              className={`knowledge-web-alert-row knowledge-web-alert-row-${alert.severity}`}
              key={alert.id}
            >
              <span className="knowledge-web-alert-icon" aria-hidden="true">
                {alert.severity === 'critical'
                  ? <CircleAlert size={20} strokeWidth={2} />
                  : <AlertTriangle size={20} strokeWidth={2} />}
              </span>
              <div className="knowledge-web-alert-copy">
                <div className="knowledge-web-alert-title-row">
                  <strong>{alert.title}</strong>
                  <span className={`knowledge-web-alert-severity knowledge-web-alert-severity-${alert.severity}`}>
                    {alert.severity === 'critical' ? 'Crítica' : 'Aviso'}
                  </span>
                </div>
                <p>{alert.detail}</p>
                {showTenant ? <small>{alert.tenantName}</small> : null}
              </div>
              <Link
                className="knowledge-web-alert-link"
                href={`/backstage/tenants/${alert.tenantId}${alert.sourceId ? `#source-${alert.sourceId}` : '#knowledge-web-sources'}`}
                aria-label={`Revisar ${alert.sourceName ?? alert.tenantName}`}
              >
                <span>Revisar</span>
                <ArrowRight aria-hidden="true" size={16} strokeWidth={2} />
              </Link>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
