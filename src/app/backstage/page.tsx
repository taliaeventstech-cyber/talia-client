import { createAdminClient } from '@/lib/supabase/admin'
import { getKnowledgeWebOperationalAlerts } from '@/lib/knowledge/web-source-alerts'
import { getCurrentBillingPeriod } from '@/lib/usage/service'
import { KnowledgeWebAlerts } from './knowledge-web-alerts'
import { WEB_USAGE_CHANNEL_KEYS } from '@/lib/attention/channel-agent'

export default async function BackstageHomePage() {
  const admin = createAdminClient()
  const period = getCurrentBillingPeriod()
  const [accountsResult, activeAccountsResult, venuesResult, usageResult, aiCostResult, webAlerts] = await Promise.all([
    admin.from('accounts').select('id', { count: 'exact', head: true }),
    admin.from('accounts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('theatres').select('id', { count: 'exact', head: true }),
    admin
      .from('tenant_usage_daily')
      .select('conversations')
      .gte('date', period.startDate)
      .lt('date', period.endDate)
      .in('channel', [...WEB_USAGE_CHANNEL_KEYS]),
    admin
      .from('ai_response_usage_daily')
      .select('cost_usd_micros')
      .gte('date', period.startDate)
      .lt('date', period.endDate),
    getKnowledgeWebOperationalAlerts(admin),
  ])

  const totalUsage = (usageResult.data ?? []).reduce(
    (total, usage) => ({ conversations: total.conversations + usage.conversations }),
    { conversations: 0 },
  )
  const totalAccounts = accountsResult.count ?? 0
  const activeAccounts = activeAccountsResult.count ?? 0
  const totalVenues = venuesResult.count ?? 0
  const measuredAiCostUsdMicros = (aiCostResult.data ?? [])
    .reduce((total, row) => total + Number(row.cost_usd_micros ?? 0), 0)

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
          <span>Coste IA medido</span>
          <strong>{formatUsdMicros(measuredAiCostUsdMicros)}</strong>
          <small>USD · Chat web del periodo actual</small>
        </article>
      </section>

      <KnowledgeWebAlerts alerts={webAlerts.alerts} error={webAlerts.error} />
    </div>
  )
}

function formatTokens(tokens: number) {
  return new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(tokens)
}

function formatUsdMicros(micros: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(micros / 1_000_000)
}
