import { createAdminClient } from '@/lib/supabase/admin'
import { getKnowledgeWebOperationalAlerts } from '@/lib/knowledge/web-source-alerts'
import { getCurrentBillingPeriod } from '@/lib/usage/service'
import { KnowledgeWebAlerts } from './knowledge-web-alerts'

export default async function BackstageHomePage() {
  const admin = createAdminClient()
  const period = getCurrentBillingPeriod()
  const [accountsResult, activeAccountsResult, venuesResult, usageResult, webAlerts] = await Promise.all([
    admin.from('accounts').select('id', { count: 'exact', head: true }),
    admin.from('accounts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('theatres').select('id', { count: 'exact', head: true }),
    admin
      .from('tenant_usage_daily')
      .select('conversations, estimated_cost_cents')
      .gte('date', period.startDate)
      .lt('date', period.endDate)
      .eq('channel', 'chatbot'),
    getKnowledgeWebOperationalAlerts(admin),
  ])

  const totalUsage = (usageResult.data ?? []).reduce(
    (total, usage) => ({
      conversations: total.conversations + usage.conversations,
      estimatedCostCents: total.estimatedCostCents + usage.estimated_cost_cents,
    }),
    { conversations: 0, estimatedCostCents: 0 },
  )
  const totalAccounts = accountsResult.count ?? 0
  const activeAccounts = activeAccountsResult.count ?? 0
  const totalVenues = venuesResult.count ?? 0

  return (
    <div className="backstage-page stack">
      <header className="backstage-page-header">
        <div>
          <p className="eyebrow">Plataforma</p>
          <h1>Resumen operativo</h1>
          <p className="muted">Estado global del servicio, consumo y conocimiento.</p>
        </div>
      </header>

      <section className="backstage-metrics" aria-label="Resumen de plataforma">
        <article className="backstage-metric">
          <span>Cuentas activas</span>
          <strong>{activeAccounts}</strong>
          <small>{totalAccounts} cuentas registradas</small>
        </article>
        <article className="backstage-metric">
          <span>Venues</span>
          <strong>{totalVenues}</strong>
          <small>Espacios configurados</small>
        </article>
        <article className="backstage-metric">
          <span>Conversaciones</span>
          <strong>{formatTokens(totalUsage.conversations)}</strong>
          <small>Periodo de facturación actual</small>
        </article>
        <article className="backstage-metric">
          <span>Coste IA estimado</span>
          <strong>{formatCurrency(totalUsage.estimatedCostCents)}</strong>
          <small>Chat web del periodo actual</small>
        </article>
      </section>

      <KnowledgeWebAlerts alerts={webAlerts.alerts} error={webAlerts.error} />
    </div>
  )
}

function formatTokens(tokens: number) {
  return new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(tokens)
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}
