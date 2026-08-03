import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentBillingPeriod } from '@/lib/usage/service'
import { ChevronLeft, ChevronRight, FileText, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AccountRowActions } from '../account-row-actions'
import { BackstagePageSizeSelect } from '../backstage-page-size-select'

interface Props {
  searchParams?: Promise<{ page?: string | string[]; page_size?: string | string[] }>
}

const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_OPTIONS = [10, 25, 50]

export default async function BackstageClientsPage({ searchParams }: Props) {
  const query = searchParams ? await searchParams : {}
  const pageParam = Array.isArray(query.page) ? query.page[0] : query.page
  const pageSizeParam = Array.isArray(query.page_size) ? query.page_size[0] : query.page_size
  const pageSize = getPageSize(pageSizeParam)
  const requestedPage = Number.parseInt(pageParam ?? '1', 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const admin = createAdminClient()
  const period = getCurrentBillingPeriod()

  const accountsResult = await admin
    .from('accounts')
    .select('id, name, slug, plan, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  const accounts = accountsResult.data ?? []
  const totalAccounts = accountsResult.count ?? 0
  const pageCount = Math.max(1, Math.ceil(totalAccounts / pageSize))
  if (totalAccounts > 0 && page > pageCount) {
    redirect(`/backstage/clients?page=${pageCount}&page_size=${pageSize}`)
  }

  const accountIds = accounts.map((account) => account.id)
  const { data: tenants } = accountIds.length
    ? await admin
      .from('theatres')
      .select('id, account_id, name, slug, plan, created_at')
      .in('account_id', accountIds)
    : { data: [] }
  const clientVenues = tenants ?? []
  const tenantIds = clientVenues.map((tenant) => tenant.id)
  const [subscriptionsResult, usageResult] = tenantIds.length
    ? await Promise.all([
      admin
        .from('tenant_subscriptions')
        .select('theatre_id, plan, included_chat_conversations,billing_period_start,billing_period_end,billing_period_start_at,billing_period_end_at')
        .in('theatre_id', tenantIds)
        .lte('billing_period_start_at', period.startAt)
        .gt('billing_period_end_at', period.startAt),
      admin
        .from('tenant_usage_daily')
        .select('theatre_id, conversations, input_tokens, output_tokens, estimated_cost_cents')
        .in('theatre_id', tenantIds)
        .gte('date', period.startDate)
        .lt('date', period.endDate)
        .eq('channel', 'chatbot'),
    ])
    : [{ data: [] }, { data: [] }]

  const venuesByAccount = new Map<string, typeof clientVenues>()
  clientVenues.forEach((tenant) => {
    const current = venuesByAccount.get(tenant.account_id) ?? []
    current.push(tenant)
    venuesByAccount.set(tenant.account_id, current)
  })

  const subscriptionByTenant = new Map(
    (subscriptionsResult.data ?? []).map((subscription) => [subscription.theatre_id, subscription]),
  )
  const usageByTenant = new Map<string, UsageSummary>()
  ;(usageResult.data ?? []).forEach((row) => {
    const current = usageByTenant.get(row.theatre_id) ?? emptyUsage()
    current.conversations += row.conversations
    current.inputTokens += row.input_tokens
    current.outputTokens += row.output_tokens
    current.estimatedCostCents += row.estimated_cost_cents
    usageByTenant.set(row.theatre_id, current)
  })

  return (
    <div className="backstage-page stack">
      <header className="backstage-page-header">
        <div>
          <p className="eyebrow">Gestión</p>
          <h1>Clientes</h1>
          <p className="muted">Cuentas, venues, planes, consumo y accesos operativos.</p>
        </div>
      </header>

      <section className="backstage-table-section" id="clients" aria-labelledby="clients-title">
        <h2 className="sr-only" id="clients-title">Clientes</h2>
        <div className="backstage-table-scroll backstage-clients-table-scroll">
          <table className="data-table backstage-accounts-table">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Planes</th>
                <th>Venues</th>
                <th>Uso chatbot</th>
                <th>Estado</th>
                <th>Creado</th>
                <th className="table-actions-heading">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const accountVenues = venuesByAccount.get(account.id) ?? []
                const usage = accountVenues.reduce((total, tenant) => addUsage(total, usageByTenant.get(tenant.id)), emptyUsage())
                const included = accountVenues.reduce((total, tenant) => {
                  const subscription = subscriptionByTenant.get(tenant.id)
                  return total + (subscription?.included_chat_conversations ?? 0)
                }, 0)
                const usageLabel = included > 0 ? `${usage.conversations} / ${included}` : `${usage.conversations}`
                const firstVenue = accountVenues[0]
                const dashboardHref = accountVenues.length === 1 && firstVenue
                  ? `/${firstVenue.id}/overview`
                  : `/accounts/${account.id}`
                const dashboardLabel = accountVenues.length === 1 ? 'Ver dashboard' : 'Ver dashboard account'
                const venuePlans = Array.from(new Set(accountVenues.map((venue) => venue.plan).filter(Boolean)))
                const venuePlansLabel = venuePlans.length ? venuePlans.map(formatPlan).join(', ') : 'Sin venues'

                return (
                  <tr key={account.id}>
                    <td>
                      {firstVenue ? (
                        <Link className="backstage-account-name" href={`/backstage/tenants/${firstVenue.id}`}>
                          {account.name}
                        </Link>
                      ) : <strong>{account.name}</strong>}
                      <p className="muted mono" title={account.id}>{shortId(account.id)}</p>
                    </td>
                    <td>{venuePlansLabel}</td>
                    <td>{accountVenues.length}</td>
                    <td>
                      {usageLabel}
                      <p
                        className="muted backstage-usage-detail"
                        title={`${formatCurrency(usage.estimatedCostCents)} · ${formatTokens(usage.inputTokens + usage.outputTokens)} tokens`}
                      >
                        {formatCurrency(usage.estimatedCostCents)} · {formatTokens(usage.inputTokens + usage.outputTokens)} tok.
                      </p>
                    </td>
                    <td><span className={`status-pill ${account.status === 'active' ? 'status-pill-active' : 'status-pill-muted'}`}>{formatAccountStatus(account.status)}</span></td>
                    <td>{new Date(account.created_at).toLocaleDateString('es-ES')}</td>
                    <td>
                      <div className="table-actions">
                        {accountVenues.length > 0 ? (
                          <IconAction href={dashboardHref} label={dashboardLabel} newTab>
                            <LayoutDashboard aria-hidden="true" size={16} strokeWidth={2} />
                          </IconAction>
                        ) : null}
                        {firstVenue ? (
                          <IconAction href={`/backstage/tenants/${firstVenue.id}`} label="Ficha Backstage">
                            <FileText aria-hidden="true" size={16} strokeWidth={2} />
                          </IconAction>
                        ) : null}
                        <AccountRowActions accountId={account.id} accountName={account.name} />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={7}><p className="muted">Aún no hay cuentas cliente.</p></td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <BackstagePagination page={page} pageCount={pageCount} pageSize={pageSize} total={totalAccounts} />
      </section>
    </div>
  )
}

type UsageSummary = {
  conversations: number
  inputTokens: number
  outputTokens: number
  estimatedCostCents: number
}

function emptyUsage(): UsageSummary {
  return { conversations: 0, inputTokens: 0, outputTokens: 0, estimatedCostCents: 0 }
}

function addUsage(total: UsageSummary, usage?: UsageSummary) {
  if (!usage) return total
  total.conversations += usage.conversations
  total.inputTokens += usage.inputTokens
  total.outputTokens += usage.outputTokens
  total.estimatedCostCents += usage.estimatedCostCents
  return total
}

function BackstagePagination({ page, pageCount, pageSize, total }: { page: number; pageCount: number; pageSize: number; total: number }) {
  if (total === 0) return null
  const firstResult = (page - 1) * pageSize + 1
  const lastResult = Math.min(total, page * pageSize)
  const hrefForPage = (targetPage: number) => `/backstage/clients?page=${targetPage}&page_size=${pageSize}`

  return (
    <nav className="table-pagination" aria-label="Paginación de clientes">
      <p>Mostrando {firstResult}-{lastResult} de {total} clientes · Página {page} de {pageCount}</p>
      <div className="table-pagination-actions">
        <BackstagePageSizeSelect value={pageSize} anchor="clients" />
        {page > 1 ? (
          <Link className="pagination-icon-button" href={hrefForPage(page - 1)} aria-label="Página anterior" scroll={false}>
            <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} />
          </Link>
        ) : <span className="pagination-icon-button button-disabled" aria-label="Página anterior"><ChevronLeft aria-hidden="true" size={16} strokeWidth={2} /></span>}
        {page < pageCount ? (
          <Link className="pagination-icon-button" href={hrefForPage(page + 1)} aria-label="Página siguiente" scroll={false}>
            <ChevronRight aria-hidden="true" size={16} strokeWidth={2} />
          </Link>
        ) : <span className="pagination-icon-button button-disabled" aria-label="Página siguiente"><ChevronRight aria-hidden="true" size={16} strokeWidth={2} /></span>}
      </div>
    </nav>
  )
}

function getPageSize(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '', 10)
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE
}

function shortId(id: string) {
  return `${id.slice(0, 8)}…`
}

function formatPlan(plan: string) {
  const labels: Record<string, string> = { essential: 'Esencial', esencial: 'Esencial', professional: 'Profesional', profesional: 'Profesional', enterprise: 'Enterprise' }
  return labels[plan] ?? plan
}

function formatAccountStatus(status: string) {
  const labels: Record<string, string> = { active: 'Activa', trialing: 'En prueba', canceled: 'Cancelada', suspended: 'Suspendida' }
  return labels[status] ?? status
}

function formatTokens(tokens: number) {
  return new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(tokens)
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function IconAction({ href, label, children, newTab = false }: { href: string; label: string; children: React.ReactNode; newTab?: boolean }) {
  return (
    <span className="tooltip-wrap tooltip-wrap-right">
      <Link className="icon-button" href={href} aria-label={label} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}>{children}</Link>
      <span className="tooltip-tip">{label}</span>
    </span>
  )
}
