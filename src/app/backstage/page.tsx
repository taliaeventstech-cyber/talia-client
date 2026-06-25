import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentBillingPeriod } from '@/lib/usage/service'
import { Building2, Edit3, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'
import { AccountRowActions } from './account-row-actions'
import { CreateTenantForm } from './create-tenant-form'

export default async function BackstageHomePage() {
  const admin = createAdminClient()
  const period = getCurrentBillingPeriod()
  const [{ data: accounts }, { data: tenants }, { data: invites }, { data: subscriptions }, { data: usageRows }] = await Promise.all([
    admin
      .from('accounts')
      .select('id, name, slug, plan, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    admin
      .from('theatres')
      .select('id, account_id, name, slug, plan, created_at'),
    admin
      .from('signup_invites')
      .select('account_id, theatre_id, accepted_at, revoked_at')
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .from('tenant_subscriptions')
      .select('theatre_id, plan, included_chat_conversations, billing_period_start, billing_period_end')
      .lte('billing_period_start', period.startDate)
      .gt('billing_period_end', period.startDate),
    admin
      .from('tenant_usage_daily')
      .select('theatre_id, conversations, input_tokens, output_tokens, estimated_cost_cents')
      .gte('date', period.startDate)
      .lt('date', period.endDate)
      .eq('channel', 'chatbot'),
  ])

  const venuesByAccount = new Map<string, NonNullable<typeof tenants>>()
  ;(tenants ?? []).forEach((tenant) => {
    const current = venuesByAccount.get(tenant.account_id) ?? []
    current.push(tenant)
    venuesByAccount.set(tenant.account_id, current)
  })

  const inviteCounts = new Map<string, { pending: number; accepted: number }>()
  ;(invites ?? []).forEach((invite) => {
    const current = inviteCounts.get(invite.account_id) ?? { pending: 0, accepted: 0 }
    if (invite.accepted_at) current.accepted += 1
    else if (!invite.revoked_at) current.pending += 1
    inviteCounts.set(invite.account_id, current)
  })

  const subscriptionByTenant = new Map((subscriptions ?? []).map((subscription) => [subscription.theatre_id, subscription]))
  const usageByTenant = new Map<string, { conversations: number; inputTokens: number; outputTokens: number; estimatedCostCents: number }>()
  ;(usageRows ?? []).forEach((row) => {
    const current = usageByTenant.get(row.theatre_id) ?? { conversations: 0, inputTokens: 0, outputTokens: 0, estimatedCostCents: 0 }
    current.conversations += row.conversations
    current.inputTokens += row.input_tokens
    current.outputTokens += row.output_tokens
    current.estimatedCostCents += row.estimated_cost_cents
    usageByTenant.set(row.theatre_id, current)
  })

  return (
    <div className="stack">
      <CreateTenantForm />

      
      <div className="backstage-tabs" role="tablist" aria-label="Secciones de backstage">
        <button className="backstage-tab backstage-tab-active" type="button" role="tab" aria-selected="true">
          Clientes
        </button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Planes venue</th>
            <th>Venues</th>
            <th>Uso chatbot</th>
            <th>Invitaciones</th>
            <th>Creado</th>
            <th className="table-actions-heading">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {(accounts ?? []).map((account) => {
            const accountVenues = venuesByAccount.get(account.id) ?? []
            const counts = inviteCounts.get(account.id) ?? { pending: 0, accepted: 0 }
            const usage = accountVenues.reduce(
              (total, tenant) => {
                const tenantUsage = usageByTenant.get(tenant.id) ?? { conversations: 0, inputTokens: 0, outputTokens: 0, estimatedCostCents: 0 }
                total.conversations += tenantUsage.conversations
                total.inputTokens += tenantUsage.inputTokens
                total.outputTokens += tenantUsage.outputTokens
                total.estimatedCostCents += tenantUsage.estimatedCostCents
                return total
              },
              { conversations: 0, inputTokens: 0, outputTokens: 0, estimatedCostCents: 0 }
            )
            const included = accountVenues.reduce((total, tenant) => {
              const subscription = subscriptionByTenant.get(tenant.id)
              return total + (subscription?.included_chat_conversations ?? 0)
            }, 0)
            const usageLabel = included > 0
              ? `${usage.conversations} / ${included}`
              : `${usage.conversations}`
            const firstVenue = accountVenues[0]
            const dashboardHref = accountVenues.length === 1 && firstVenue
              ? `/${firstVenue.id}/overview`
              : `/accounts/${account.id}`
            const dashboardLabel = accountVenues.length === 1 ? 'Ver dashboard' : 'Ver dashboard account'
            const venuePlans = Array.from(new Set(accountVenues.map((venue) => venue.plan).filter(Boolean)))
            const venuePlansLabel = venuePlans.length ? venuePlans.join(', ') : 'Sin venues'

            return (
              <tr key={account.id}>
                <td>
                  <strong>{account.name}</strong>
                  <p className="muted mono">{account.id}</p>
                </td>
                <td>{venuePlansLabel}</td>
                <td>{accountVenues.length}</td>
                <td>
                  {usageLabel}
                  <p className="muted">{formatCurrency(usage.estimatedCostCents)} · {formatTokens(usage.inputTokens + usage.outputTokens)} tokens</p>
                </td>
                <td>{counts.pending} pendientes · {counts.accepted} aceptadas</td>
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
                        <Edit3 aria-hidden="true" size={16} strokeWidth={2} />
                      </IconAction>
                    ) : null}
                    <IconAction href={`/backstage/accounts/${account.id}`} label="Ver cuenta">
                      <Building2 aria-hidden="true" size={16} strokeWidth={2} />
                    </IconAction>
                    <AccountRowActions accountId={account.id} accountName={account.name} firstVenueId={firstVenue?.id} />
                  </div>
                </td>
              </tr>
            )
          })}
          {(accounts ?? []).length === 0 ? (
            <tr>
              <td colSpan={7}>
                <p className="muted">Aún no hay cuentas cliente.</p>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

function formatTokens(tokens: number) {
  return new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(tokens)
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

function IconAction({ href, label, children, newTab = false }: { href: string; label: string; children: React.ReactNode; newTab?: boolean }) {
  return (
    <span className="tooltip-wrap tooltip-wrap-right">
      <Link className="icon-button" href={href} aria-label={label} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}>
        {children}
      </Link>
      <span className="tooltip-tip">{label}</span>
    </span>
  )
}
