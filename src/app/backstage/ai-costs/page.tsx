import { createAdminClient } from '@/lib/supabase/admin'
import { buildAiCostMonthlyHistory, getAiCostHistoryStartDate } from '@/lib/usage/ai-cost-history'
import { getCurrentBillingPeriod } from '@/lib/usage/service'

export default async function BackstageAiCostsPage() {
  const admin = createAdminClient()
  const now = new Date()
  const period = getCurrentBillingPeriod(now)
  const historyStartDate = getAiCostHistoryStartDate(now)
  const [responseUsageResult, componentUsageResult, venuesResult, legacyUsageResult] = await Promise.all([
    admin
      .from('ai_response_usage_daily')
      .select('*')
      .gte('date', historyStartDate)
      .lt('date', period.endDate),
    admin
      .from('ai_usage_daily')
      .select('*')
      .gte('date', period.startDate)
      .lt('date', period.endDate),
    admin.from('theatres').select('id, name'),
    admin
      .from('tenant_usage_daily')
      .select('estimated_cost_cents')
      .gte('date', period.startDate)
      .lt('date', period.endDate)
      .eq('channel', 'web'),
  ])

  const historicalResponseRows = responseUsageResult.data ?? []
  const responseRows = historicalResponseRows.filter((row) => (
    Boolean(row.date) && row.date! >= period.startDate && row.date! < period.endDate
  ))
  const componentRows = componentUsageResult.data ?? []
  const venueNames = new Map((venuesResult.data ?? []).map((venue) => [venue.id, venue.name]))
  const totals = responseRows.reduce((total, row) => ({
    responses: total.responses + (row.response_count ?? 0),
    requests: total.requests + (row.request_count ?? 0),
    inputTokens: total.inputTokens + (row.input_tokens ?? 0),
    cachedInputTokens: total.cachedInputTokens + (row.cached_input_tokens ?? 0),
    outputTokens: total.outputTokens + (row.output_tokens ?? 0),
    costUsdMicros: total.costUsdMicros + Number(row.cost_usd_micros ?? 0),
  }), emptyTotals())
  const legacyCostCents = (legacyUsageResult.data ?? [])
    .reduce((total, row) => total + row.estimated_cost_cents, 0)
  const costPerResponse = totals.responses > 0 ? totals.costUsdMicros / totals.responses : 0
  const projection = projectMonthCost(totals.costUsdMicros)
  const dailyCosts = buildDailyCosts(responseRows, period.startDate)
  const maxDailyCost = Math.max(...dailyCosts.map((day) => day.costUsdMicros), 1)
  const tenantRows = buildTenantRows(responseRows, venueNames)
  const componentTotals = buildComponentRows(componentRows)
  const modelTotals = buildModelRows(componentRows)
  const monthlyHistory = buildAiCostMonthlyHistory(historicalResponseRows, now)

  return (
    <div className="backstage-page stack">
      <header className="backstage-page-header">
        <div>
          <p className="eyebrow">Observabilidad</p>
          <h1>Costes de IA</h1>
          <p className="muted">Consumo medido del mes actual e historial mensual por cliente, modelo y componente.</p>
        </div>
        <span className="status-pill status-pill-muted">Periodo actual</span>
      </header>

      <section className="backstage-metrics" aria-label="Resumen de costes de IA">
        <Metric label="Coste medido" value={formatUsdMicros(totals.costUsdMicros)} detail="USD · precios versionados" />
        <Metric label="Proyección mensual" value={formatUsdMicros(projection)} detail="Ritmo del mes actual" />
        <Metric label="Coste por respuesta" value={formatUsdMicros(costPerResponse)} detail={`${formatNumber(totals.responses)} respuestas con IA`} />
        <Metric label="Tokens medidos" value={formatTokens(totals.inputTokens + totals.outputTokens)} detail={`${formatTokens(totals.cachedInputTokens)} de entrada en caché`} />
      </section>

      <section className="backstage-table-section" aria-labelledby="cost-history-title">
        <div className="section-title-row">
          <div>
            <h2 id="cost-history-title">Historial mensual</h2>
            <p className="muted">Hasta 12 meses de costes medidos. Los meses sin actividad se muestran a cero.</p>
          </div>
        </div>
        <div className="backstage-table-scroll">
          <table className="data-table backstage-cost-table">
            <thead>
              <tr>
                <th>Periodo</th>
                <th>Coste medido</th>
                <th>Respuestas</th>
                <th>Peticiones</th>
                <th>Tokens</th>
                <th>Coste / respuesta</th>
              </tr>
            </thead>
            <tbody>
              {monthlyHistory.map((entry) => (
                <tr key={entry.month}>
                  <td>
                    <strong>{formatCostPeriod(entry.periodStart)}</strong>
                    {entry.isCurrent ? <small><span className="status-pill status-pill-active">Actual</span></small> : null}
                  </td>
                  <td><strong>{formatUsdMicros(entry.costUsdMicros)}</strong></td>
                  <td>{formatNumber(entry.responses)}</td>
                  <td>{formatNumber(entry.requests)}</td>
                  <td>{formatTokens(entry.inputTokens + entry.outputTokens)}</td>
                  <td>{formatUsdMicros(entry.responses ? entry.costUsdMicros / entry.responses : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="backstage-cost-grid">
        <article className="backstage-cost-panel">
          <div className="section-title-row">
            <div>
              <h2>Coste diario</h2>
              <p className="muted">USD medidos, sin mezclar estimaciones legacy.</p>
            </div>
          </div>
          <div className="backstage-cost-chart" role="img" aria-label="Coste diario de IA del mes actual">
            {dailyCosts.map((day) => (
              <div className="backstage-cost-bar-column" key={day.date} title={`${day.label}: ${formatUsdMicros(day.costUsdMicros)}`}>
                <span className="backstage-cost-bar" style={{ height: `${Math.max(2, (day.costUsdMicros / maxDailyCost) * 100)}%` }} />
                <small>{day.shortLabel}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="backstage-cost-panel">
          <div className="section-title-row">
            <div>
              <h2>Calidad de la medición</h2>
              <p className="muted">Los importes nuevos proceden de tokens reales del proveedor.</p>
            </div>
          </div>
          <dl className="backstage-cost-quality">
            <div><dt>Medición actual</dt><dd><span className="status-pill status-pill-active">Measured</span></dd></div>
            <div><dt>Peticiones OpenAI</dt><dd>{formatNumber(totals.requests)}</dd></div>
            <div><dt>Estimación legacy</dt><dd>{formatLegacyCents(legacyCostCents)}</dd></div>
            <div><dt>Moneda operativa</dt><dd>USD</dd></div>
          </dl>
          <p className="backstage-cost-note">El valor legacy se conserva aparte porque fue calculado mediante heurística y redondeo por petición. No participa en las métricas medidas.</p>
        </article>
      </section>

      <section className="backstage-table-section" aria-labelledby="tenant-costs-title">
        <div className="section-title-row">
          <div>
            <h2 id="tenant-costs-title">Consumo por cliente</h2>
            <p className="muted">Ordenado por coste medido durante el periodo.</p>
          </div>
        </div>
        <div className="backstage-table-scroll">
          <table className="data-table backstage-cost-table">
            <thead><tr><th>Cliente</th><th>Respuestas</th><th>Peticiones</th><th>Tokens</th><th>Coste USD</th><th>Coste / respuesta</th></tr></thead>
            <tbody>
              {tenantRows.map((row) => (
                <tr key={row.tenantId}>
                  <td><strong>{row.name}</strong></td>
                  <td>{formatNumber(row.responses)}</td>
                  <td>{formatNumber(row.requests)}</td>
                  <td>{formatTokens(row.inputTokens + row.outputTokens)}</td>
                  <td>{formatUsdMicros(row.costUsdMicros)}</td>
                  <td>{formatUsdMicros(row.responses ? row.costUsdMicros / row.responses : 0)}</td>
                </tr>
              ))}
              {!tenantRows.length ? <tr><td colSpan={6}><p className="muted">Todavía no hay consumo medido en este periodo.</p></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="backstage-cost-grid">
        <BreakdownTable title="Por componente" labelHeading="Componente" rows={componentTotals} />
        <BreakdownTable title="Por modelo" labelHeading="Modelo" rows={modelTotals} />
      </section>
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="backstage-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function BreakdownTable({ title, labelHeading, rows }: { title: string; labelHeading: string; rows: BreakdownRow[] }) {
  return (
    <article className="backstage-table-section">
      <div className="section-title-row"><h2>{title}</h2></div>
      <div className="backstage-table-scroll">
        <table className="data-table backstage-cost-breakdown-table">
          <thead><tr><th>{labelHeading}</th><th>Peticiones</th><th>Tokens</th><th>Coste USD</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.label}><td><strong>{formatBreakdownLabel(row.label)}</strong></td><td>{formatNumber(row.requests)}</td><td>{formatTokens(row.tokens)}</td><td>{formatUsdMicros(row.costUsdMicros)}</td></tr>)}
            {!rows.length ? <tr><td colSpan={4}><p className="muted">Sin datos medidos.</p></td></tr> : null}
          </tbody>
        </table>
      </div>
    </article>
  )
}

type Totals = ReturnType<typeof emptyTotals>
type BreakdownRow = { label: string; requests: number; tokens: number; costUsdMicros: number }

function emptyTotals() {
  return { responses: 0, requests: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costUsdMicros: 0 }
}

function buildTenantRows(rows: Array<{ theatre_id: string | null; response_count: number | null; request_count: number | null; input_tokens: number | null; output_tokens: number | null; cost_usd_micros: number | null }>, names: Map<string, string>) {
  const grouped = new Map<string, Totals>()
  rows.forEach((row) => {
    if (!row.theatre_id) return
    const current = grouped.get(row.theatre_id) ?? emptyTotals()
    current.responses += row.response_count ?? 0
    current.requests += row.request_count ?? 0
    current.inputTokens += row.input_tokens ?? 0
    current.outputTokens += row.output_tokens ?? 0
    current.costUsdMicros += Number(row.cost_usd_micros ?? 0)
    grouped.set(row.theatre_id, current)
  })
  return Array.from(grouped, ([tenantId, totals]) => ({ tenantId, name: names.get(tenantId) ?? 'Venue sin nombre', ...totals }))
    .sort((a, b) => b.costUsdMicros - a.costUsdMicros)
}

function buildComponentRows(rows: Array<{ component: string | null; request_count: number | null; input_tokens: number | null; output_tokens: number | null; cost_usd_micros: number | null }>) {
  return buildBreakdownRows(rows, (row) => row.component)
}

function buildModelRows(rows: Array<{ model: string | null; request_count: number | null; input_tokens: number | null; output_tokens: number | null; cost_usd_micros: number | null }>) {
  return buildBreakdownRows(rows, (row) => row.model)
}

function buildBreakdownRows<T extends { request_count: number | null; input_tokens: number | null; output_tokens: number | null; cost_usd_micros: number | null }>(rows: T[], getLabel: (row: T) => string | null) {
  const grouped = new Map<string, BreakdownRow>()
  rows.forEach((row) => {
    const label = getLabel(row)
    if (!label) return
    const current = grouped.get(label) ?? { label, requests: 0, tokens: 0, costUsdMicros: 0 }
    current.requests += row.request_count ?? 0
    current.tokens += (row.input_tokens ?? 0) + (row.output_tokens ?? 0)
    current.costUsdMicros += Number(row.cost_usd_micros ?? 0)
    grouped.set(label, current)
  })
  return Array.from(grouped.values()).sort((a, b) => b.costUsdMicros - a.costUsdMicros)
}

function buildDailyCosts(rows: Array<{ date: string | null; cost_usd_micros: number | null }>, startDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const now = new Date()
  const dayCount = Math.max(1, Math.min(now.getUTCDate(), 31))
  const costs = new Map<string, number>()
  rows.forEach((row) => {
    if (row.date) costs.set(row.date, (costs.get(row.date) ?? 0) + Number(row.cost_usd_micros ?? 0))
  })
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(index + 1)
    const key = date.toISOString().slice(0, 10)
    return { date: key, label: date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }), shortLabel: String(index + 1), costUsdMicros: costs.get(key) ?? 0 }
  })
}

function projectMonthCost(costUsdMicros: number) {
  const now = new Date()
  const elapsedDays = Math.max(1, now.getUTCDate())
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  return (costUsdMicros / elapsedDays) * daysInMonth
}

function formatUsdMicros(micros: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(micros / 1_000_000)
}

function formatLegacyCents(cents: number) {
  return cents > 0 ? `${(cents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (legacy)` : 'Sin estimaciones'
}

function formatTokens(tokens: number) {
  return new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(tokens)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-ES').format(value)
}

function formatBreakdownLabel(value: string) {
  const labels: Record<string, string> = { answer_agent: 'Answer Agent', language_agent: 'Language Agent', retrieval_embedding: 'Embedding de búsqueda' }
  return labels[value] ?? value
}

function formatCostPeriod(periodStart: string) {
  return new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${periodStart}T00:00:00Z`))
}
